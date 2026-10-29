import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { AlertTriangle, Database, ExternalLink } from 'lucide-react';

export const FirebaseSetupNotice: React.FC = () => {
  const { t, language } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Database className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-slate-900">
            {language === 'bn'
              ? 'ফায়ারবেস কনফিগারেশন প্রয়োজন'
              : 'Firebase Configuration Required'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {language === 'bn'
              ? 'ভার্চুয়াল ম্যানেজার সম্পূর্ণ অনলাইন ক্লাউড ডেটাবেজে হিসাব সংরক্ষণ করে। অনুগ্রহ করে ফায়ারবেস প্রজেক্ট কনফিগারেশন যোগ করুন।'
              : 'Virtual Manager saves all ledger records securely in Cloud Firestore. Please configure your Firebase credentials.'}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
          <div className="font-semibold text-slate-900">
            {language === 'bn' ? 'প্রয়োজনীয় পদক্ষেপ:' : 'Required Setup Steps:'}
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
            <li>Firebase Console-এ গিয়ে একটি প্রজেক্ট তৈরি করুন।</li>
            <li>Authentication (Email/Password & Google) সক্রিয় করুন।</li>
            <li>Cloud Firestore Database তৈরি করুন।</li>
            <li>
              <code className="text-teal-700 bg-teal-50 px-1 py-0.5 rounded font-mono">
                firebase-applet-config.json
              </code>{' '}
              ফাইলটিতে আপনার credentials প্রদান করুন।
            </li>
          </ol>
        </div>

        <div className="text-center pt-2">
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 transition-colors"
          >
            <span>Firebase Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
