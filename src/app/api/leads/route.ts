import { LeadSchema } from "@/lib/lead-schema";

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

  const validatedLead = result.data;
  console.log("New lead:", validatedLead);

  return Response.json(
    {
      success: true,
      message: "Lead received",
    },
    { status: 201 }
  );
}