import React from 'react';
import { Shield, ArrowRight, Activity, MapPin, Layers, Radio } from 'lucide-react';

interface LandingHeroProps {
  onEnterDashboard: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onEnterDashboard }) => {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-slate-100 text-slate-900 overflow-hidden">
      {/* Stylized background terrain grid & subtle ambient accents */}
      <div className="absolute inset-0 map-grid opacity-15 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-slate-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Hero Card */}
      <div className="relative z-10 max-w-3xl w-full text-center space-y-8 p-8 sm:p-12 rounded-3xl bg-white backdrop-blur-md border border-slate-200 shadow-xl">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-300 text-[#0f2942] text-xs font-bold tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-[#0f2942] animate-pulse" />
          <span>TerraGuard LEWP — Pilot: Aizawl, Mizoram</span>
        </div>

        {/* Cinematic Headline */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-sans text-slate-900">
            Predict. Verify. Protect.
          </h1>
          <p className="text-base sm:text-xl text-slate-600 font-normal max-w-xl mx-auto">
            AI-powered landslide intelligence for safer communities.
          </p>
        </div>

        {/* Subtitle Description */}
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          Operational early warning platform combining high-resolution CartoDEM terrain partitions, 
          three-tank Soil Water Index hydrologic modeling, and human-in-the-loop verification for the Disaster Management Authority of Mizoram.
        </p>

        {/* Key Feature Badges */}
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-left pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <Layers className="w-4 h-4 text-[#0f2942] mb-1" />
            <div className="text-xs font-bold text-slate-900">11,778 Units</div>
            <div className="text-[10px] text-slate-500">Aizawl District</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <Radio className="w-4 h-4 text-[#FF9933] mb-1" />
            <div className="text-xs font-bold text-slate-900">3-Tank SWI</div>
            <div className="text-[10px] text-slate-500">Hydrologic Core</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <Shield className="w-4 h-4 text-emerald-600 mb-1" />
            <div className="text-xs font-bold text-slate-900">Human Triage</div>
            <div className="text-[10px] text-slate-500">CAP 1.2 Dispatch</div>
          </div>
        </div>

        {/* Main Action CTA */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onEnterDashboard}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#0f2942] hover:bg-[#163859] text-white text-sm font-bold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Open Monitoring Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom Disclaimer */}
        <div className="text-[11px] text-slate-500 pt-2 font-mono">
          National & State Disaster Management Authority • Aizawl District, Mizoram • 03 Sep 2026 Run
        </div>
      </div>
    </div>
  );
};
