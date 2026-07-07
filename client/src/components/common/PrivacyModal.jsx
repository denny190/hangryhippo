import React from 'react';
import Modal from './Modal.jsx';

export default function PrivacyModal({ onClose }) {
  return (
    <Modal title="Privacy Policy" onClose={onClose} size="sm">
      <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
        <p className="text-xs text-slate-500">Last updated July 2026</p>

        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">What we collect</h3>
          <p>Your email address used to log in, and the nutrition data you enter: meal plans, recipes, foods, and notes. Nothing else.</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">How it is used</h3>
          <p>Your data is used for one purpose only: running your account. It is <span className="text-slate-100 font-medium">never sold, never shared, and never used</span> for advertising, profiling, or any purpose beyond providing the app to you.</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Where it is stored</h3>
          <p>Your data is stored in a secure, encrypted cloud database. Each account is fully isolated and no account can access another account's data.</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Your rights</h3>
          <p>You can export a full copy of your data at any time from Settings. To request account deletion, open an issue on GitHub.</p>
        </div>

        <button className="btn-primary w-full justify-center mt-2" onClick={onClose}>Got it</button>
      </div>
    </Modal>
  );
}
