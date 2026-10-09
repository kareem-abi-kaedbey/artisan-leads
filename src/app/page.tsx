import Link from "next/link";

const services = [
  { title: "Agencement sur mesure", description: "Bibliothèques, espaces de travail et séparations : un intérieur structuré autour de vos usages.", detail: "Donner du sens à chaque mètre carré" },
  { title: "Meubles & rangements", description: "Dressings, placards et meubles intégrés qui trouvent leur place, jusque dans les espaces les plus singuliers.", detail: "Une place pour chaque chose" },
  { title: "Cuisines & intérieurs", description: "Des cuisines et des pièces de vie pensées comme un ensemble, avec des matières et des finitions en harmonie.", detail: "Relier le beau à l’utile" },
];

const projects = [
  { title: "Une bibliothèque habitée", category: "Bibliothèque & meuble bas", variant: "library" },
  { title: "L’essentiel, bien rangé", category: "Dressing & rangements intégrés", variant: "wardrobe" },
  { title: "Le cœur de la maison", category: "Cuisine & espace de vie", variant: "kitchen" },
];

function InteriorVisual({ variant = "library" }: { variant?: string }) {
  return (
    <div className={`interior interior--${variant}`} aria-hidden="true">
      <div className="interior-light" />
      <div className="interior-floor" />
      <div className="interior-cabinet">
        <div className="interior-shelves">
          <span className="interior-books" /><span className="interior-vase" />
        </div>
        <div className="interior-doors" />
      </div>
      <div className="interior-seat" />
    </div>
  );
}

export default function Home() {
  return (
    <>
      <a href="#main" className="skip-link">Aller au contenu</a>
      <header className="border-b border-black/10 bg-[#f4f0e8]">
        <nav aria-label="Navigation principale" className="page-width flex flex-wrap items-center justify-between gap-x-4 gap-y-4 py-4">
          <Link href="/" className="text-xl font-semibold tracking-tight">Atelier Noyer<span className="ml-1 text-stone-400">.</span></Link>
          <div className="order-3 flex w-full justify-between gap-4 border-t border-black/10 pt-4 text-sm md:order-none md:w-auto md:gap-8 md:border-0 md:pt-0">
            <a className="nav-link" href="#projects">Réalisations</a>
            <a className="nav-link" href="#services">Services</a>
            <a className="nav-link" href="#about">À propos</a>
          </div>
          <a href="#quote" className="button button-dark text-xs sm:text-sm">Demander un devis <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <main id="main">
        <section className="page-width hero grid items-center gap-7 py-8 md:grid-cols-[1fr_1.05fr] md:gap-8 md:py-10 lg:gap-12">
          <div>
            <p className="eyebrow mb-4 flex items-center gap-2"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#88684b]" />Menuiserie sur mesure · Île-de-France</p>
            <h1 className="hero-title">Des agencements pensés pour <span className="text-[#88684b] italic">votre intérieur.</span></h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-stone-600 sm:text-base">Conception, fabrication et installation de meubles et agencements sur mesure pour transformer chaque espace en un projet unique.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#quote" className="button button-dark">Demander un devis <span aria-hidden="true">↗</span></a>
              <a href="#projects" className="button button-outline">Voir nos réalisations</a>
            </div>
            <p className="mt-6 flex items-center gap-3 border-t border-[#d9d0c3] pt-5 text-xs text-stone-600"><span className="h-px w-8 bg-stone-400" /> Du premier croquis aux dernières finitions.</p>
          </div>
          <figure className="hero-figure relative">
            <div className="hero-image overflow-hidden"><InteriorVisual /></div>
            <figcaption className="hero-caption"><span className="font-medium">Le bois. La lumière. Votre quotidien.</span><span className="text-[10px] uppercase tracking-wider">Visualisation d’intention</span></figcaption>
          </figure>
        </section>

        <section id="services" className="border-y border-[#d9d0c3] bg-[#eae3d8] py-10 md:py-14">
          <div className="page-width">
            <div className="grid gap-4 md:grid-cols-[1.1fr_1fr] md:gap-12">
              <div><p className="eyebrow">01 — Notre savoir-faire</p><h2 className="section-title mt-3">Du sur-mesure,<br />dans tous ses détails.</h2></div>
              <p className="max-w-md self-end text-sm leading-7 text-stone-600">Un angle à apprivoiser, une pièce à réinventer, une idée à concrétiser. Nous imaginons des solutions qui s’adaptent à votre espace et à votre façon de vivre.</p>
            </div>
            <div className="mt-7 grid gap-3 md:grid-cols-3 md:gap-4">
              {services.map((service, index) => (
                <article key={service.title} className="service-card flex flex-col">
                  <span className="service-number">0{index + 1}</span>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight">{service.title}</h3>
                  <p className="mt-3 mb-5 text-sm leading-6 text-stone-600">{service.description}</p>
                  <p className="mt-auto border-t border-[#d9d0c3] pt-4 text-xs font-medium text-[#70553e]">{service.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="projects" className="page-width py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div><p className="eyebrow">02 — Réalisations & inspirations</p><h2 className="section-title mt-4">Des idées qui prennent place.</h2></div>
            <a href="#quote" className="text-sm underline decoration-stone-300 underline-offset-8">Imaginer votre projet <span aria-hidden="true">↗</span></a>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">Trois pistes d’aménagement pour se projeter. Ces visuels illustratifs seront remplacés par les photographies de nos réalisations.</p>
          <div className="mt-7 grid gap-5 md:grid-cols-3 md:gap-5">
            {projects.map((project, index) => (
              <article key={project.title} className="project-card">
                <div className="relative overflow-hidden"><InteriorVisual variant={project.variant} /><span className="project-number">0{index + 1}</span></div>
                <div className="px-5 py-5"><p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#7a624c]">{project.category}</p><h3 className="mt-2 text-xl font-semibold tracking-tight">{project.title}</h3></div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="about-section py-10 text-white md:py-14">
          <div className="page-width grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-14">
            <div><p className="eyebrow text-stone-400">03 — L’esprit Atelier Noyer</p><h2 className="section-title mt-5">Le goût du travail bien fait.<br /><span className="text-stone-400">Et du détail juste.</span></h2><p className="mt-5 max-w-lg text-sm leading-7 text-stone-300">Nous croyons qu’un bel agencement commence par une écoute attentive. Comprendre vos habitudes, respecter les proportions et choisir les bonnes matières : c’est ainsi qu’un meuble trouve naturellement sa place chez vous.</p></div>
            <div className="divide-y divide-white/15 border-l border-white/15 pl-6 md:pl-8">
              {[
                ["Le soin de la matière", "Des assemblages aux finitions, chaque détail contribue à un intérieur agréable à vivre."],
                ["Un dessin pour vous", "Des lignes, des dimensions et des usages pensés pour votre lieu, plutôt qu’une solution standard."],
                ["La proximité au quotidien", "Un accompagnement en Île-de-France, de la réflexion sur votre projet à son installation."],
              ].map(([title, description]) => <div key={title} className="py-4 first:pt-0 last:pb-0"><h3 className="text-lg font-medium">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-stone-300">{description}</p></div>)}
            </div>
          </div>
        </section>

        <section className="page-width flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center md:py-12" aria-labelledby="cta-title">
          <div><p className="eyebrow">Une envie, un espace, un projet ?</p><h2 id="cta-title" className="section-title mt-4">Faisons place à vos idées.</h2></div>
          <a href="#quote" className="button button-dark">Parlons de votre projet <span aria-hidden="true">↗</span></a>
        </section>

        <section id="quote" className="border-y border-[#d9d0c3] bg-[#eae3d8] py-10 md:py-12">
          <div className="page-width grid gap-6 md:grid-cols-[1.1fr_1fr] md:gap-14">
            <div><p className="eyebrow">04 — Votre projet commence ici</p><h2 className="section-title mt-4">Préparons votre demande de devis.</h2><p className="mt-5 max-w-lg leading-7 text-stone-600">Pour un premier échange utile, rassemblez quelques éléments : la pièce à aménager, ses dimensions approximatives, vos inspirations et le calendrier souhaité.</p></div>
            <div className="self-center border border-[#d9d0c3] bg-[#f8f5ef] p-6 sm:p-7"><h3 className="text-lg font-medium">Un intérieur à votre mesure.</h3><p className="mt-3 text-sm leading-7 text-stone-600">Agencement, rangements ou cuisine : décrivez votre envie, même si elle n’en est qu’à ses débuts.</p><p className="mt-5 text-sm text-stone-500">Les coordonnées de contact seront disponibles prochainement.</p></div>
          </div>
        </section>
      </main>

      <footer className="page-width flex flex-col justify-between gap-5 py-6 sm:flex-row sm:items-center">
        <div><Link href="/" className="text-lg font-semibold tracking-tight">Atelier Noyer.</Link><p className="mt-2 text-xs text-stone-500">Menuiserie sur mesure · Île-de-France</p></div>
        <p className="text-xs text-stone-500">© {new Date().getFullYear()} Atelier Noyer</p>
        <a href="#quote" className="text-sm underline decoration-stone-300 underline-offset-4">Votre projet <span aria-hidden="true">↗</span></a>
      </footer>
    </>
  );
}
