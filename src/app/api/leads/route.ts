import { LeadSchema } from "@/lib/lead-schema";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const formData = await request.formData();

  const lead = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    location: formData.get("location"),
    projectType: formData.get("projectType"),
    budget: formData.get("budget"),
    description: formData.get("description"),
  };

  // Validate the text fields with Zod.
  const result = LeadSchema.safeParse(lead);

  if (!result.success) {
    const issue = result.error.issues[0];

    const fieldMessages: Record<string, string> = {
      name: "Le nom est requis.",
      email: "L’adresse email n’est pas valide.",
      phone: "Le numéro de téléphone n’est pas valide.",
      location: "La localisation est requise.",
      projectType: "Choisissez un type de projet valide.",
      budget: "Choisissez un budget valide.",
      description: "Décrivez votre projet.",
    };

    const message =
      issue &&
      issue.code !== "invalid_type" &&
      issue.code !== "invalid_value"
        ? issue.message
        : fieldMessages[String(issue?.path[0])] ??
          "Veuillez vérifier les informations saisies.";

    return Response.json(
      {
        success: false,
        message,
      },
      { status: 400 }
    );
  }

  // Collect uploaded images.
  const images: File[] = [];

  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  for (const entry of formData.getAll("images")) {
    // An empty file input may appear as an empty value.
    if (entry === "") {
      continue;
    }

    if (typeof entry === "string") {
      return Response.json(
        {
          success: false,
          message: "Veuillez joindre des fichiers image valides.",
        },
        { status: 400 }
      );
    }

    // Ignore an empty File object.
    if (entry.size === 0) {
      continue;
    }

    images.push(entry);
  }

  // Maximum of 5 images.
  if (images.length > 5) {
    return Response.json(
      {
        success: false,
        message: "Vous pouvez joindre au maximum 5 images.",
      },
      { status: 400 }
    );
  }

  // Validate each image before creating anything in the database.
  for (const image of images) {
    if (!Object.hasOwn(extensions, image.type)) {
      return Response.json(
        {
          success: false,
          message: "Les images doivent être au format JPEG, PNG ou WebP.",
        },
        { status: 400 }
      );
    }

    if (image.size > 5 * 1024 * 1024) {
      return Response.json(
        {
          success: false,
          message: "Chaque image doit faire au maximum 5 Mo.",
        },
        { status: 400 }
      );
    }
  }

  const validatedLead = result.data;

  let leadId: string | undefined;

  // Paths of files that may need to be deleted if something fails later.
  const storagePaths: string[] = [];

  // Declare it here so both try AND catch can access it.
  let supabaseServer: ReturnType<typeof getSupabaseServer> | null = null;

  try {
    // Lazy initialization:
    // Supabase is only created when this request actually needs the database.
    supabaseServer = getSupabaseServer();

    // Create the lead.
    const { data: createdLead, error } = await supabaseServer
      .from("leads")
      .insert({
        name: validatedLead.name,
        email: validatedLead.email,
        phone: validatedLead.phone,
        location: validatedLead.location,
        project_type: validatedLead.projectType,
        budget: validatedLead.budget,
        description: validatedLead.description,
      })
      .select("id, created_at")
      .single();

    if (error) {
      throw error;
    }

    if (!createdLead) {
      throw new Error("Lead was inserted but no row was returned.");
    }

    leadId = createdLead.id;

    // Upload each image and save its metadata.
    for (const image of images) {
      const extension = extensions[image.type];

      if (!extension) {
        throw new Error("Unexpected invalid image type.");
      }

      const storagePath =
        `${createdLead.id}/${crypto.randomUUID()}.${extension}`;

      // Add the path before uploading so cleanup can still attempt deletion
      // if the upload succeeded but the response was interrupted.
      storagePaths.push(storagePath);

      const { error: uploadError } = await supabaseServer.storage
        .from("lead-images")
        .upload(storagePath, image, {
          contentType: image.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: metadataError } = await supabaseServer
        .from("lead_images")
        .insert({
          lead_id: createdLead.id,
          storage_path: storagePath,
          original_name: image.name,
          mime_type: image.type,
          size_bytes: image.size,
        });

      if (metadataError) {
        throw metadataError;
      }
    }

    return Response.json(
      {
        success: true,
        message: "Lead received",
        id: createdLead.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to save lead:", error);

    // Only attempt Supabase cleanup if the client was successfully created.
    if (supabaseServer && storagePaths.length > 0) {
      try {
        const { error: cleanupError } = await supabaseServer.storage
          .from("lead-images")
          .remove(storagePaths);

        if (cleanupError) {
          console.error(
            "Failed to clean up lead images:",
            cleanupError
          );
        }
      } catch (cleanupError) {
        console.error(
          "Failed to clean up lead images:",
          cleanupError
        );
      }
    }

    if (supabaseServer && leadId) {
      // Remove image metadata explicitly.
      try {
        const { error: cleanupError } = await supabaseServer
          .from("lead_images")
          .delete()
          .eq("lead_id", leadId);

        if (cleanupError) {
          console.error(
            "Failed to clean up image metadata:",
            cleanupError
          );
        }
      } catch (cleanupError) {
        console.error(
          "Failed to clean up image metadata:",
          cleanupError
        );
      }

      // Remove the newly-created lead.
      try {
        const { error: cleanupError } = await supabaseServer
          .from("leads")
          .delete()
          .eq("id", leadId);

        if (cleanupError) {
          console.error(
            "Failed to clean up lead:",
            cleanupError
          );
        }
      } catch (cleanupError) {
        console.error(
          "Failed to clean up lead:",
          cleanupError
        );
      }
    }

    return Response.json(
      {
        success: false,
        message:
          "Une erreur est survenue lors de l’enregistrement de votre demande.",
      },
      { status: 500 }
    );
  }
}