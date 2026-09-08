import type { Metadata } from "next";
import {
    Instrument_Sans,
    Instrument_Serif,
    Spline_Sans_Mono,
} from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const instrumentSans = Instrument_Sans({
    variable: "--font-instrument-sans",
    subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
    variable: "--font-instrument-serif",
    weight: "400",
    style: ["normal", "italic"],
    subsets: ["latin"],
});

const splineSansMono = Spline_Sans_Mono({
    variable: "--font-spline-mono",
    weight: ["400", "500"],
    subsets: ["latin"],
});

export const metadata: Metadata = {
    metadataBase: new URL("https://kd-five-kappa.vercel.app"),
    title: "KD — The operating system for Indian law",
    description:
        "Research, drafting, review, and workflows — one counsel-grade AI trusted with the whole matter, not just the brief.",
    icons: {
        icon: [
            { url: "/icon.svg", type: "image/svg+xml" },
            { url: "/favicon.ico" },
        ],
        apple: "/apple-touch-icon.png",
    },
    openGraph: {
        type: "website",
        url: "https://kd-five-kappa.vercel.app",
        siteName: "KD",
        title: "KD — The operating system for Indian law",
        description:
            "Research, drafting, review, and workflows — one counsel-grade AI trusted with the whole matter, not just the brief.",
        images: [
            {
                url: "/link-image.jpg",
                width: 1200,
                height: 651,
                alt: "KD",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "KD — The operating system for Indian law",
        description:
            "Research, drafting, review, and workflows — one counsel-grade AI trusted with the whole matter, not just the brief.",
        images: ["/link-image.jpg"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${instrumentSans.variable} ${instrumentSerif.variable} ${splineSansMono.variable} font-sans antialiased`}
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
