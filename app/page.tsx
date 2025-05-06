"use client";

import Link from "next/link";
import { useState } from "react";
import {
  RiShieldCheckLine,
  RiSpeedLine,
  RiPlugLine,
  RiOpenSourceLine,
  RiArrowRightLine,
  RiArrowDownSLine,
  RiGithubFill,
  RiExternalLinkLine,
} from "@remixicon/react";

// FAQ Item Component
function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[rgb(var(--border))]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left font-medium text-[rgb(var(--foreground))] hover:text-indigo-500 transition-colors"
      >
        <span className="text-sm">{question}</span>
        <RiArrowDownSLine
          className={`h-4 w-4 text-[rgb(var(--foreground-tertiary))] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-4 text-sm text-[rgb(var(--foreground-secondary))] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon: Icon,
  title,
  description,
  link,
  linkText,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  link?: string;
  linkText?: string;
}) {
  return (
    <div className="group rounded-lg surface-1 p-5 border border-[rgb(var(--border))] hover:border-[rgb(var(--border-elevated))] transition-colors">
      <div className="mb-3 inline-flex rounded-md bg-indigo-500/10 p-2">
        <Icon className="h-5 w-5 text-indigo-500" />
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-[rgb(var(--foreground))]">
        {title}
      </h3>
      <p className="text-sm text-[rgb(var(--foreground-secondary))] leading-relaxed">
        {description}
      </p>
      {link && linkText && (
        <Link
          href={link}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-400 transition-colors"
        >
          {linkText}
          <RiArrowRightLine className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen surface-0">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[rgb(var(--border))]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500">
              <span className="text-xs font-semibold text-white">A</span>
            </div>
            <span className="text-sm font-medium text-[rgb(var(--foreground))]">
              AsyncAnticheat
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="https://github.com/oraxen/asyncanticheat"
              className="text-xs font-medium text-[rgb(var(--foreground-secondary))] hover:text-[rgb(var(--foreground))] transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="https://docs.asyncanticheat.com"
              className="text-xs font-medium text-[rgb(var(--foreground-secondary))] hover:text-[rgb(var(--foreground))] transition-colors"
            >
              Documentation
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-medium text-[rgb(var(--foreground-secondary))] hover:text-[rgb(var(--foreground))] transition-colors"
            >
              Dashboard
            </Link>
          </nav>

          <Link
            href="https://docs.asyncanticheat.com"
            className="inline-flex items-center rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            View Docs
          </Link>
        </div>
      </header>

      {/* Hero Section with HackedServer Thread */}
      <main>
        <section className="mx-auto max-w-3xl px-4 py-12">
          {/* Thread Showcase */}
          <div className="relative rounded-lg border border-[rgb(var(--border))] surface-1 p-1.5 overflow-hidden">
            <div className="relative aspect-[16/9] overflow-hidden rounded bg-[rgb(var(--background))]">
              <iframe
                src="https://hackedserver.org/thread/index.html?mode=embedded"
                className="absolute inset-0 h-full w-full"
                title="HackedServer Thread Showcase"
                sandbox="allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
            >
              Open Dashboard
            </Link>
            <Link
              href="https://github.com/oraxen/asyncanticheat"
              className="inline-flex items-center gap-2 rounded-md border border-[rgb(var(--border))] surface-1 px-4 py-2 text-sm font-medium text-[rgb(var(--foreground-secondary))] hover:border-[rgb(var(--border-elevated))] hover:text-[rgb(var(--foreground))] transition-colors"
            >
              <RiGithubFill className="h-4 w-4" />
              View on GitHub
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="mx-auto max-w-5xl px-4 py-12">
          <div className="text-center mb-8">
            <span className="inline-block rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-500">
              Features
            </span>
            <h2 className="mt-3 text-xl font-semibold text-[rgb(var(--foreground))]">
              Why choose AsyncAnticheat?
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={RiSpeedLine}
              title="Async by Design"
              description="Offload cheat detection to cloud services. Zero impact on your server's TPS."
            />
            <FeatureCard
              icon={RiShieldCheckLine}
              title="NCP-style Checks"
              description="Battle-tested detection algorithms inspired by NoCheatPlus."
            />
            <FeatureCard
              icon={RiPlugLine}
              title="Modular Architecture"
              description="Register external check modules that process packet data independently."
            />
            <FeatureCard
              icon={RiOpenSourceLine}
              title="Open Source"
              description="Fully transparent and community-driven. Inspect the code, contribute improvements."
              link="https://docs.asyncanticheat.com"
              linkText="Read the docs"
            />
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mx-auto max-w-2xl px-4 py-12">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-[rgb(var(--foreground))]">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-sm text-[rgb(var(--foreground-secondary))]">
              Can&apos;t find the answer?{" "}
              <Link
                href="https://discord.gg/asyncanticheat"
                className="text-indigo-500 hover:text-indigo-400"
              >
                Join our Discord
              </Link>
            </p>
          </div>

          <div className="rounded-lg border border-[rgb(var(--border))] surface-1 px-4">
            <FaqItem question="What is AsyncAnticheat?">
              AsyncAnticheat is a next-generation anticheat system that offloads
              detection to cloud services. Your Minecraft server captures
              relevant packets and sends them to external &quot;modules&quot;
              that analyze player behavior and report findings back to a central
              dashboard.
            </FaqItem>
            <FaqItem question="What servers are supported?">
              AsyncAnticheat supports Paper, Spigot, BungeeCord, and Velocity.
              The plugin uses PacketEvents for cross-platform packet
              interception.
            </FaqItem>
            <FaqItem question="What checks are included?">
              The NCP module includes fight checks (angle, speed, reach,
              direction) and movement checks (speed, more-packets, no-fall). You
              can also create custom modules.
            </FaqItem>
            <FaqItem question="Does it impact server performance?">
              Minimal impact. Packet capture runs on the network thread with
              efficient filtering. Heavy processing happens off-server. Most
              servers see less than 1% overhead.
            </FaqItem>
            <FaqItem question="How do I create custom modules?">
              Modules are HTTP services that receive packet batches and return
              findings. You can write them in any language. See the{" "}
              <Link
                href="https://docs.asyncanticheat.com"
                className="text-indigo-500 hover:underline"
              >
                documentation
              </Link>{" "}
              for details.
            </FaqItem>
            <FaqItem question="Is AsyncAnticheat free?">
              Yes, AsyncAnticheat is open source under GPL-3.0. You can
              self-host everything.
            </FaqItem>
            <FaqItem question="Where can I find documentation?">
              Full documentation is available at{" "}
              <Link
                href="https://docs.asyncanticheat.com"
                className="text-indigo-500 hover:underline inline-flex items-center gap-0.5"
              >
                docs.asyncanticheat.com
                <RiExternalLinkLine className="h-3 w-3" />
              </Link>
            </FaqItem>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgb(var(--border))]">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
            <p className="text-xs text-[rgb(var(--foreground-muted))]">
              © {new Date().getFullYear()}{" "}
              <Link
                href="https://thomas.md"
                className="text-[rgb(var(--foreground-tertiary))] hover:text-[rgb(var(--foreground-secondary))] transition-colors"
              >
                Thomas Marchand
              </Link>
            </p>
            <Link
              href="https://github.com/oraxen/asyncanticheat"
              className="text-[rgb(var(--foreground-muted))] hover:text-[rgb(var(--foreground-tertiary))] transition-colors"
            >
              <RiGithubFill className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
