import { LandingNav } from "./LandingNav";
import { Hero } from "./Hero";
import { Ticker } from "./Ticker";
import { PlatformShowcase } from "./PlatformShowcase";
import { Capabilities } from "./Capabilities";
import { QuoteBand } from "./QuoteBand";
import { Outcomes } from "./Outcomes";
import { FinalCta } from "./FinalCta";

export function Landing() {
    return (
        <div className="kd-landing min-h-screen">
            <div aria-hidden className="kd-grain" />
            <LandingNav />
            <main>
                <Hero />
                <Ticker />
                <PlatformShowcase />
                <Capabilities />
                <QuoteBand />
                <Outcomes />
                <FinalCta />
            </main>
        </div>
    );
}
