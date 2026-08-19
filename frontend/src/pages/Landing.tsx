import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-violet text-white">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="text-xl font-bold tracking-tight">🛡️ SheGuard</div>
        <div className="space-x-3">
          <Link to="/wearer/login" className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
            Wearer Login
          </Link>
          <Link to="/guardian/login" className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
            Guardian Login
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
          Your Safety. Their Connection.
          <br /> Our Protection.
        </h1>
        <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto">
          SheGuard connects a wearer's real-time emergency signal to their trusted contacts,
          nearby community guardians, and configured emergency services — in seconds.
        </p>

        <div className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link to="/wearer/signup" className="px-6 py-3 rounded-xl bg-brand-red font-semibold hover:opacity-90">
            I'm a Wearer — Get Protected
          </Link>
          <Link
            to="/guardian/signup"
            className="px-6 py-3 rounded-xl bg-brand-green font-semibold hover:opacity-90"
          >
            I'm a Guardian — Help Protect
          </Link>
        </div>

        <section className="mt-24 grid md:grid-cols-3 gap-6 text-left">
          <Feature title="One-Tap SOS" desc="Press the SOS button. A 60-second countdown starts, giving you time to cancel a false alarm." />
          <Feature title="Real Escalation" desc="If not stopped, your 5 emergency contacts, nearby police, and community guardians are alerted automatically." />
          <Feature title="Live Location" desc="Guardians within 5 KM see your live location on a map the moment an alert escalates — no manual refresh." />
        </section>

        <section className="mt-20 text-left grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-bold mb-3">How SheGuard Works</h2>
            <ol className="space-y-2 text-white/80 list-decimal list-inside">
              <li>Wearer connects their SheGuard Bluetooth device and enables location.</li>
              <li>In an emergency, the wearer presses SOS or triggers a voice keyword.</li>
              <li>A 60-second countdown gives a window to cancel.</li>
              <li>If not cancelled, contacts, police, and nearby guardians are notified in real time.</li>
            </ol>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-3">Guardian Monitoring</h2>
            <p className="text-white/80">
              Guardians opt in to share their location. When someone nearby needs help, they receive
              an instant notification, a live map, and the wearer's live address — so the closest
              trusted person can respond first.
            </p>
          </div>
        </section>
      </main>

      <footer className="text-center text-white/60 text-sm py-8">
        © {new Date().getFullYear()} SheGuard. Built for safety, not surveillance.
      </footer>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white/10 rounded-xl p-6">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-white/70 text-sm">{desc}</p>
    </div>
  );
}
