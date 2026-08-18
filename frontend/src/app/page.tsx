import type { Metadata } from "next";
import {
    Instrument_Serif,
    Instrument_Sans,
    Spline_Sans_Mono,
} from "next/font/google";
import { Landing } from "@/components/landing/Landing";

const instrumentSerif = Instrument_Serif({
    weight: "400",
    style: ["normal", "italic"],
    subsets: ["latin"],
    variable: "--font-instrument-serif",
});

const instrumentSans = Instrument_Sans({
    subsets: ["latin"],
    variable: "--font-instrument-sans",
});

const splineSansMono = Spline_Sans_Mono({
    weight: ["400", "500"],
    subsets: ["latin"],
    variable: "--font-spline-mono",
});

export const metadata: Metadata = {
    title: "KD — The operating system for Indian law",
    description:
        "Research, drafting, review, and workflows — one counsel-grade AI trusted with the whole matter, not just the brief.",
};

export default function RootPage() {
    return (
        <div
            className={`${instrumentSerif.variable} ${instrumentSans.variable} ${splineSansMono.variable}`}
        >
            <Landing />
        </div>
    );
}
