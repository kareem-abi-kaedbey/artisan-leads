import { LeadSchema } from "@/lib/lead-schema";
import { supabaseServer } from "@/lib/supabase-server";

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
    const message = issue && issue.code !== "invalid_type" && issue.code !== "invalid_value"
      ? issue.message
      : fieldMessages[String(issue?.path[0])] ?? "Veuillez vérifier les informations saisies.";

    return Response.json({ success: false, message }, { status: 400 });
  }

  const images: File[] = [];
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  for (const entry of formData.getAll("images")) {
    if (entry === "") continue;
    if (typeof entry === "string") {
      return Response.json(
        { success: false, message: "Veuillez joindre des fichiers image valides." },
        { status: 400 }
      );
    }
    if (entry.size === 0) continue;
    images.push(entry);
  }

  if (images.length > 5) {
    return Response.json(
      { success: false, message: "Vous pouvez joindre au maximum 5 images." },
      { status: 400 }
    );
  }

  for (const image of images) {
    if (!Object.hasOwn(extensions, image.type)) {
      return Response.json(
        { success: false, message: "Les images doivent être au format JPEG, PNG ou WebP." },
        { status: 400 }
      );
    }
    if (image.size > 5 * 1024 * 1024) {
      return Response.json(
        { success: false, message: "Chaque image doit faire au maximum 5 Mo." },
        { status: 400 }
      );
    }
  }

  const validatedLead = result.data;
  let leadId: string | undefined;
  const storagePaths: string[] = [];
  try {
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

    leadId = createdLead.id;

    for (const image of images) {
      const storagePath = `${createdLead.id}/${crypto.randomUUID()}.${extensions[image.type]}`;
      // Include the attempted path in cleanup in case the upload response is lost.
      storagePaths.push(storagePath);
      const { error: uploadError } = await supabaseServer.storage
        .from("lead-images")
        .upload(storagePath, image, { contentType: image.type, upsert: false });

      if (uploadError) throw uploadError;

      const { error: metadataError } = await supabaseServer
        .from("lead_images")
        .insert({
          lead_id: createdLead.id,
          storage_path: storagePath,
          original_name: image.name,
          mime_type: image.type,
          size_bytes: image.size,
        });

      if (metadataError) throw metadataError;
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

    if (storagePaths.length > 0) {
      try {
        const { error: cleanupError } = await supabaseServer.storage
          .from("lead-images")
          .remove(storagePaths);
        if (cleanupError) console.error("Failed to clean up lead images:", cleanupError);
      } catch (cleanupError) {
        console.error("Failed to clean up lead images:", cleanupError);
      }
    }

    if (leadId) {
      // Remove metadata explicitly so cleanup also works without an ON DELETE CASCADE.
      try {
        const { error: cleanupError } = await supabaseServer
          .from("lead_images")
          .delete()
          .eq("lead_id", leadId);
        if (cleanupError) console.error("Failed to clean up image metadata:", cleanupError);
      } catch (cleanupError) {
        console.error("Failed to clean up image metadata:", cleanupError);
      }

      try {
        const { error: cleanupError } = await supabaseServer
          .from("leads")
          .delete()
          .eq("id", leadId);
        if (cleanupError) console.error("Failed to clean up lead:", cleanupError);
      } catch (cleanupError) {
        console.error("Failed to clean up lead:", cleanupError);
      }
    }

    return Response.json(
      {
        success: false,
        message: "Une erreur est survenue lors de l’enregistrement de votre demande.",
      },
      { status: 500 }
    );
  }
}
