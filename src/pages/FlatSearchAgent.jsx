import { Link } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import FlatSearchAgentChat from "../components/FlatSearchAgentChat";
import { ArrowRight } from "lucide-react";

export default function FlatSearchAgent() {
  return (
    <div className="min-h-[100dvh] bg-mesh-light antialiased">
      <Navbar variant="marketing" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid lg:grid-cols-[1fr,1.1fr] gap-10 lg:gap-14 items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-rose-600 mb-3">AI flat search</p>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4 leading-tight">
              Tell us what you need — we&apos;ll find the flat
            </h1>
            <p className="text-slate-600 leading-relaxed mb-6 max-w-lg">
              Our agent asks a few questions about area, budget, and move-in timeline, then recommends homes from
              MovEazy&apos;s live catalogue. When the Python service is running (`be/agent`), recommendations use
              trained TF-IDF scoring on scraped broker data.
            </p>
            <ul className="space-y-3 text-sm text-slate-700 mb-8">
              <li className="flex gap-2">
                <span className="text-rose-600 font-bold">1.</span>
                Answer quick questions in chat (or tap suggestions)
              </li>
              <li className="flex gap-2">
                <span className="text-rose-600 font-bold">2.</span>
                Get ranked matches with a match score
              </li>
              <li className="flex gap-2">
                <span className="text-rose-600 font-bold">3.</span>
                Open details, save, or book a visit — or browse all on the map
              </li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/new-listings"
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-rose-600"
              >
                Browse all listings
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/agents"
                className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-rose-600"
              >
                Connect with an expert
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          <FlatSearchAgentChat />
        </div>
      </main>
      <Footer />
    </div>
  );
}
