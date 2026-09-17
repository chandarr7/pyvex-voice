import React, { useState } from 'react';
import { X, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    workEmail: '',
    company: '',
    monthlyMinutes: '100,000 - 500,000 mins',
    useCase: 'Clinical / Healthcare Triage',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      // Auto close after brief confirmation
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="bg-[#121418] border border-white/[0.1] rounded-3xl w-full max-w-lg p-8 shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/[0.08] text-white/50 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="text-center py-10 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif text-white">Demo Request Dispatched</h3>
            <p className="text-xs text-white/60 font-sans max-w-xs mx-auto">
              A Pyvex voice solutions engineer will contact you at <span className="text-white font-mono">{formData.workEmail}</span> within 2 hours.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-full text-xs font-mono uppercase tracking-wider bg-white text-[#0b0c0e] font-semibold"
            >
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-400 block mb-1">
                Enterprise Briefing
              </span>
              <h2 className="text-2xl font-serif text-white">
                Schedule a Pyvex STUDIO Architecture Briefing
              </h2>
              <p className="text-xs text-white/50 mt-1 font-sans">
                Explore private VPC deployment, custom SIP trunking, and voice biometrics.
              </p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] uppercase text-white/50 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Dr. Jordan Reed"
                  className="w-full bg-[#181a1f] border border-white/10 focus:border-white/30 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-white/50 block mb-1">Corporate Email</label>
                <input
                  type="email"
                  required
                  value={formData.workEmail}
                  onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                  placeholder="jordan@enterprise.com"
                  className="w-full bg-[#181a1f] border border-white/10 focus:border-white/30 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-white/50 block mb-1">Company</label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Acme Health"
                    className="w-full bg-[#181a1f] border border-white/10 focus:border-white/30 rounded-xl px-3.5 py-2.5 text-white placeholder-white/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-white/50 block mb-1">Estimated Mins</label>
                  <select
                    value={formData.monthlyMinutes}
                    onChange={(e) => setFormData({ ...formData, monthlyMinutes: e.target.value })}
                    className="w-full bg-[#181a1f] border border-white/10 focus:border-white/30 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                  >
                    <option>50k - 100k mins/mo</option>
                    <option>100k - 500k mins/mo</option>
                    <option>500k - 2M mins/mo</option>
                    <option>2M+ mins/mo</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-full text-xs font-mono uppercase tracking-wider font-semibold bg-[#f4f1eb] hover:bg-white text-[#0b0c0e] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Confirm Demo Booking</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
