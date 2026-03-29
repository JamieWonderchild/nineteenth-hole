'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Mic,
  FileText,
  Brain,
  MessageCircle,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import { LandingNav } from './LandingNav';
import { ComparisonSection } from './ComparisonSection';

// ─── Feature data ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Mic,
    title: 'Voice-to-Documentation',
    description:
      'Speak naturally during encounters. AI extracts clinical facts and generates SOAP notes in real-time.',
  },
  {
    icon: Brain,
    title: 'Case Reasoning Engine',
    description:
      'Get differential diagnoses, drug interaction checks, and evidence-based treatment plans from specialized AI agents.',
  },
  {
    icon: FileText,
    title: 'Auto-Generated Documents',
    description:
      'SOAP notes, client summaries, discharge instructions, referral letters, and prescriptions — all generated from your conversation.',
  },
  {
    icon: MessageCircle,
    title: 'Patient Companion AI',
    description:
      'Send patients a link to an AI assistant that answers questions about their visit, medications, and home care.',
  },
  {
    icon: Shield,
    title: 'Built for Clinical',
    description:
      'Evidence-based clinical reasoning, drug interaction checks, and medical literature references. Not a generic AI.',
  },
  {
    icon: Clock,
    title: 'Save Hours Daily',
    description:
      'Eliminate documentation backlog. Finish notes before the patient leaves the room.',
  },
  {
    icon: Receipt,
    title: 'Billing Catalog',
    description:
      'Manage your procedure catalog with custom pricing, categories, and tax settings. Generate itemised invoices directly from encounters.',
  },
];

// ─── Pricing data ──────────────────────────────────────────────────────────────

const PRICING = [
  {
    name: 'Solo Provider',
    price: 79,
    period: '/month',
    description: 'For individual practitioners',
    features: [
      '1 physician',
      '150 encounters/month',
      'Voice-to-SOAP documentation',
      'Patient summaries & discharge instructions',
      '50 patient companion sessions/month',
      'Follow-up tracking',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Practice',
    price: 149,
    period: '/month',
    description: 'For small to mid-size clinics',
    features: [
      '2 providers included (+$49/extra)',
      '500 encounters/month',
      'Everything in Solo',
      '200 patient companion sessions/month',
      'Team management & roles',
      '14-day free trial',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Multi-Location',
    price: 299,
    period: '/month',
    description: 'For hospital groups & chains',
    features: [
      '5 providers included (+$39/extra)',
      '2,000 encounters/month',
      'Everything in Practice',
      'Unlimited companion sessions',
      'Multi-location support',
      'Priority support',
    ],
    cta: 'Contact Us',
    highlighted: false,
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            AI-Powered Documentation
            <br />
            <span className="text-primary">for Clinical Practices</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Speak naturally during encounters. [PRODUCT_NAME] handles the documentation, generates clinical
            notes, and even helps patients understand their visit.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 text-base px-8">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-base px-8">
                See How It Works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/50 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Everything You Need in One Platform</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              From voice capture to client communication, [PRODUCT_NAME] streamlines your entire documentation
              workflow.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-background rounded-xl p-6 border shadow-sm"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">How It Works</h2>
          </div>
          <div className="space-y-12">
            {[
              {
                step: '1',
                title: 'Record Your Encounter',
                description:
                  'Click the microphone and speak naturally. [PRODUCT_NAME] listens and extracts clinical facts in real-time — vitals, symptoms, history, and findings.',
              },
              {
                step: '2',
                title: 'Review & Add Your Expertise',
                description:
                  'Review the extracted facts, add your diagnosis and treatment plan. Run the case reasoning engine for differential diagnoses and drug interaction checks.',
              },
              {
                step: '3',
                title: 'Generate Documents Instantly',
                description:
                  'One click generates SOAP notes, patient summaries, discharge instructions, prescriptions, and referral letters. Share a companion link with patients.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-6 items-start">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Matrix */}
      <ComparisonSection />

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/50 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-muted-foreground">
              No setup fees. No contracts. Cancel anytime.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`bg-background rounded-xl p-8 border shadow-sm flex flex-col ${
                  plan.highlighted ? 'ring-2 ring-primary border-primary relative' : ''
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="mt-8 space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" className="mt-8 block">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold">Ready to Transform Your Practice?</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Join clinical professionals who are saving hours of documentation time every day.
          </p>
          <Link href="/sign-up" className="mt-8 inline-block">
            <Button size="lg" className="gap-2 text-base px-8">
              Start Your Free Trial <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">[PRODUCT_NAME]</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} [PRODUCT_NAME]. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
