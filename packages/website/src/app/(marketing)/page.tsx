"use client";

import Link from "next/link";
import { Server, Shield, Zap, Link2, FileCode, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/ui/code-block";
import { GradientCard } from "@/components/ui/gradient-card";
import {
  tagline,
  description,
  packageManagers,
  backendConfigs,
  integrationFiles,
  benefits,
  features,
} from "@/copy";

const btnHoverPrimary =
  "duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]";
const btnHoverOutline = "duration-300 hover:-translate-y-0.5 hover:border-violet-500";

function AnnouncementBanner() {
  return (
    <div className="flex justify-center">
      <Link
        href="/blog/golden-age-of-log-files"
        className="group inline-flex items-center gap-3 px-4 py-2 rounded-full border border-violet-200
          bg-white/80 backdrop-blur-sm hover:border-violet-400 hover:bg-violet-50 transition-colors"
      >
        <span className="text-xs font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
          New
        </span>
        <span className="text-sm text-foreground/80">
          The Golden Age of Log Files — why we went back to server-side analytics
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-violet-600 group-hover:rotate-45 transition-all" />
      </Link>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pt-8 pb-20 overflow-hidden">
      {/* Mesh gradient blobs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-200/60 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-pink-200/50 rounded-full blur-3xl" />
        <div className="absolute -top-10 right-1/3 w-72 h-72 bg-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute top-40 left-1/3 w-64 h-64 bg-fuchsia-200/30 rounded-full blur-3xl" />
      </div>
      <div className="max-w-5xl mx-auto px-6 relative">
        <AnnouncementBanner />
        <div className="max-w-3xl mx-auto text-center mt-8">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-foreground mb-6">
            {tagline.split(" ").slice(0, 2).join(" ")}
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              {tagline.split(" ").slice(2).join(" ")}
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className={btnHoverPrimary}>
              <Link href="#how-it-works">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className={btnHoverOutline}>
              <Link href="/demo">View Demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

const benefitIcons = {
  "100% Server-Side": Server,
  "GDPR Compliant": Shield,
  "Zero Overhead": Zap,
  "Backend-Agnostic": Link2,
} as const;

function Benefits() {
  return (
    <section id="features" className="py-20 bg-muted/50">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-4">Why Nextlytics?</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Traditional analytics compromise privacy, slow down your site, and lose data. Nextlytics
          fixes all of that.
        </p>
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          {benefits.map((benefit) => {
            const Icon = benefitIcons[benefit.title as keyof typeof benefitIcons];
            return (
              <GradientCard key={benefit.title}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 text-violet-600 bg-violet-100">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </GradientCard>
            );
          })}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <GradientCard key={feature.title}>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </GradientCard>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-4">Add Analytics in 3 Steps</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          No complex setup. No dashboard configuration. Just a few lines of code.
        </p>

        <div className="space-y-8">
          {/* Step 1: Install */}
          <div className="bg-muted/50 rounded-xl border border-border overflow-hidden">
            <Tabs defaultValue="npm">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                    1
                  </span>
                  <span className="font-medium">Install the package</span>
                </div>
                <TabsList>
                  <TabsTrigger value="npm">npm</TabsTrigger>
                  <TabsTrigger value="bun">bun</TabsTrigger>
                  <TabsTrigger value="pnpm">pnpm</TabsTrigger>
                  <TabsTrigger value="yarn">yarn</TabsTrigger>
                </TabsList>
              </div>
              {Object.entries(packageManagers).map(([key, command]) => (
                <TabsContent key={key} value={key} className="m-0">
                  <CodeBlock code={command} language="bash" />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Step 2: Configure backend */}
          <div className="bg-muted/50 rounded-xl border border-border overflow-hidden">
            <Tabs defaultValue="segment">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                    2
                  </span>
                  <span className="font-medium">Configure your backend</span>
                </div>
                <div className="flex items-center gap-3">
                  <TabsList>
                    {Object.entries(backendConfigs).map(([key, config]) => (
                      <TabsTrigger key={key} value={key}>
                        {config.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <Button asChild variant="link" size="sm" className="text-muted-foreground">
                    <Link href="/integrations">All integrations →</Link>
                  </Button>
                </div>
              </div>
              {Object.entries(backendConfigs).map(([key, config]) => (
                <TabsContent key={key} value={key} className="m-0">
                  <CodeBlock code={config.code} language="typescript" />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Step 3: Integrate */}
          <div className="bg-muted/50 rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                3
              </span>
              <span className="font-medium">Integrate with your app</span>
            </div>
            <div className="p-4 space-y-4">
              {Object.values(integrationFiles).map((file) => (
                <div
                  key={file.filename}
                  className="rounded-lg border border-border overflow-hidden bg-background"
                >
                  <div className="px-4 py-2.5 bg-muted border-b border-border flex items-center gap-2">
                    <FileCode className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium font-mono">{file.filename}</span>
                  </div>
                  <CodeBlock code={file.code} language="typescript" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-muted-foreground mt-12">
          That&apos;s it. Every page view is now tracked server-side.
        </p>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-5xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get accurate analytics?</h2>
          <p className="text-muted-foreground mb-8">
            Stop losing data. Stop asking for cookie consent. Start tracking with confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className={btnHoverPrimary}>
              <Link href="#how-it-works">Get Started</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className={btnHoverOutline}>
              <Link href="/demo">View Demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Benefits />
      <HowItWorks />
      <CTA />
    </>
  );
}
