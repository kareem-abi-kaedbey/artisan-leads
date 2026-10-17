"use client";

import { useState, type FormEvent } from "react";

type SubmissionStatus = "idle" | "submitting" | "success" | "error";

export default function QuoteForm() {
  const [status, setStatus] = useState<SubmissionStatus>("idle");

  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    setErrorMessage("");
    setStatus("submitting");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setErrorMessage(
          typeof body?.message === "string" && body.message.trim()
            ? body.message
            : "L’envoi a échoué. Veuillez réessayer.",
        );
        setStatus("error");
        return;
      }

      form.reset();
      setStatus("success");
    } catch {
      setErrorMessage("L’envoi a échoué. Veuillez réessayer.");
      setStatus("error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={status === "submitting"}
      className="grid gap-5 rounded-sm border border-[#d9d0c3] bg-[#f8f5ef] p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Nom
          <input
            type="text"
            name="name"
            required
            minLength={2}
            placeholder="Jean Dupont"
            className="border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e]"
          />
        </label>

        <label className="grid gap-2 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            placeholder="jean@email.fr"
            className="border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e]"
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">
          Téléphone
          <input
            type="tel"
            name="phone"
            required
            minLength={6}
            placeholder="06 12 34 56 78"
            className="border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e]"
          />
        </label>

        <label className="grid gap-2 text-sm">
          Localisation
          <input
            type="text"
            name="location"
            required
            minLength={2}
            placeholder="Paris 15e"
            className="border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e]"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm">
        Type de projet
        <select
          name="projectType"
          required
          className="border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e]"
        >
          <option>Agencement sur mesure</option>
          <option>Meuble / rangement</option>
          <option>Cuisine</option>
          <option>Autre</option>
        </select>
      </label>

      <label className="grid gap-2 text-sm">
        Budget approximatif
        <select
          name="budget"
          required
          className="border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e]"
        >
          <option>Moins de 2 000 €</option>
          <option>2 000 € – 5 000 €</option>
          <option>5 000 € – 10 000 €</option>
          <option>Plus de 10 000 €</option>
          <option>Je ne sais pas encore</option>
        </select>
      </label>

      <label className="grid gap-2 text-sm">
        Décrivez votre projet
        <textarea
          name="description"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="Pièce concernée, dimensions approximatives, style recherché, contraintes particulières..."
          className="resize-y border border-[#cfc4b5] bg-white px-4 py-3 outline-none focus:border-[#70553e]"
        />
      </label>

      <label className="grid gap-2 text-sm">
        Photos ou inspirations
        <input
          type="file"
          name="images"
          multiple
          accept="image/*"
          className="border border-dashed border-[#b9aa96] bg-white px-4 py-5 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="button button-dark mt-2 w-full sm:w-fit"
      >
        {status === "submitting" ? "Envoi..." : "Envoyer ma demande"}
      </button>

      <p role="status" aria-live="polite" className="text-sm leading-5 text-stone-600">
        {status === "success" && "Votre demande a bien été envoyée."}
        {status === "error" && errorMessage}
      </p>
    </form>
  );
}
