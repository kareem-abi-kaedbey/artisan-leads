export default function Home() {
  return (
    <>
      <header className="border-b border-zinc-200">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="text-xl font-semibold">
            Atelier Noyer
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#projects">Réalisations</a>
            <a href="#services">Services</a>
            <a href="#about">À propos</a>
          </div>

          <a
            href="#quote"
            className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white"
          >
            Demander un devis
          </a>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 md:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-zinc-500">
              Menuiserie sur mesure • Île-de-France
            </p>

            <h1 className="max-w-xl text-5xl font-semibold leading-tight tracking-tight">
              Des agencements pensés pour votre intérieur.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-600">
              Conception, fabrication et installation de meubles et agencements sur
              mesure pour transformer chaque espace en un projet unique.
            </p>

            <div className="mt-8 flex gap-4">
              <a
                href="#quote"
                className="rounded-full bg-black px-6 py-3 font-medium text-white"
              >
                Demander un devis
              </a>

              <a
                href="#projects"
                className="rounded-full border border-zinc-300 px-6 py-3 font-medium"
              >
                Voir nos réalisations
              </a>
            </div>
          </div>

          <div className="flex min-h-[500px] items-center justify-center rounded-3xl bg-zinc-200">
            <p className="text-zinc-500">Image du projet</p>
          </div>
        </section>
      </main>
    </>
  );
}