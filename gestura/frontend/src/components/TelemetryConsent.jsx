import { useState, useEffect } from 'react';
import API from '../services/api';

export default function TelemetryConsent() {
  const [consentGiven, setConsentGiven] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Check if user has given consent before
    const savedConsent = localStorage.getItem('telemetry_consent');
    setConsentGiven(savedConsent === 'true');
  }, []);

  const handleConsentToggle = (e) => {
    const isChecked = e.target.checked;
    setConsentGiven(isChecked);
    localStorage.setItem('telemetry_consent', isChecked);
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      setMessage('Please enter feedback');
      return;
    }

    try {
      await API.post('/api/telemetry/feedback', {
        telemetry_id: null, // In production, get from prediction log
        feedback_text: feedbackText,
        rating: null
      });
      setMessage('Thank you for your feedback!');
      setFeedbackText('');
      setShowFeedback(false);
    } catch (error) {
      setMessage('Failed to submit feedback');
    }
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-emerald-900 mb-3">Data & Feedback</h3>
      
      <div className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={handleConsentToggle}
            className="w-5 h-5 rounded border-emerald-300"
          />
          <span className="text-sm text-emerald-900">
            Allow us to collect anonymized prediction data to improve accuracy
          </span>
        </label>
        <p className="text-xs text-emerald-700 mt-2 ml-8">
          We collect: predicted gesture, confidence level, latency. Your personal data is never stored.
        </p>
      </div>

      {consentGiven && (
        <button
          onClick={() => setShowFeedback(!showFeedback)}
          className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition text-sm"
        >
          {showFeedback ? 'Cancel Feedback' : 'Share Feedback'}
        </button>
      )}

      {showFeedback && (
        <form onSubmit={handleSubmitFeedback} className="mt-4 p-4 bg-white rounded border border-emerald-200">
          {message && (
            <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 p-2 rounded">
              {message}
            </div>
          )}
          <textarea
            placeholder="Tell us about your experience with the gesture interpreter..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="w-full p-2 border border-emerald-200 rounded text-sm mb-3"
            rows="4"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition text-sm"
          >
            Submit Feedback
          </button>
        </form>
      )}
    </div>
  );
}
