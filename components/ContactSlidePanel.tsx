
import React, { useState } from 'react';
import { supportService } from '../services/supportService';

interface ContactSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  initialEmail?: string;
}

const ContactSlidePanel: React.FC<ContactSlidePanelProps> = ({ isOpen, onClose, initialName = '', initialEmail = '' }) => {
  const [submitted, setSubmitted] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportForm, setSupportForm] = useState({
    name: initialName,
    email: initialEmail,
    subject: '',
    message: ''
  });
  
  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportLoading(true);
    try {
      await supportService.submitInquiry(supportForm);
      setSubmitted(true);
      setSupportForm({ name: initialName, email: initialEmail, subject: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      console.error("Support submission failed:", error);
      alert("Failed to send message. Please try again later.");
    } finally {
      setSupportLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 h-full w-full bg-white z-[110] transition-all duration-700 ease-in-out transform ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0 pointer-events-none'} flex flex-col overflow-y-auto`}>
      <div className="min-h-screen w-full flex flex-col items-center py-12 px-6 sm:py-20">
        <div className="w-full max-w-5xl">
          <div className="flex justify-between items-center mb-16">
            <button onClick={onClose} className="group flex items-center gap-2 text-black hover:text-black transition-all font-black uppercase text-[10px] tracking-widest">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-all">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </div>
              <span>Close</span>
            </button>
          </div>

          <div className="mb-20 text-center md:text-left">
            <h2 className="text-4xl sm:text-6xl font-black tracking-tight mb-4 text-black">Contact Us</h2>
            <p className="text-black font-medium text-xl">Get in touch with the SmartPrepAca team.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-16 lg:gap-24">
            {/* Left: Form */}
            <div className="flex-1 space-y-8">
              <div>
                <p className="text-black font-bold text-lg mb-2">Have a question or issue?</p>
                <p className="text-black">We'd love to hear from you. Fill out the form below and we'll be in touch.</p>
              </div>

              {submitted ? (
                <div className="bg-primary-50 border border-primary-100 p-8 rounded-3xl text-center animate-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-primary-600/20">
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <h3 className="text-2xl font-black text-black mb-2">Message Sent!</h3>
                  <p className="text-black font-medium">Thank you for reaching out. We'll get back to you shortly.</p>
                </div>
              ) : (
                <form onSubmit={handleSupportSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">Full Name</label>
                      <input 
                        type="text" 
                        placeholder="John Doe" 
                        required 
                        value={supportForm.name}
                        onChange={(e) => setSupportForm({...supportForm, name: e.target.value})}
                        className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary-600 transition-all font-medium" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-black">Email Address</label>
                      <input 
                        type="email" 
                        placeholder="john@example.com" 
                        required 
                        value={supportForm.email}
                        onChange={(e) => setSupportForm({...supportForm, email: e.target.value})}
                        className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary-600 transition-all font-medium" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black">Subject</label>
                    <input 
                      type="text" 
                      placeholder="How can we help?" 
                      required 
                      value={supportForm.subject}
                      onChange={(e) => setSupportForm({...supportForm, subject: e.target.value})}
                      className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary-600 transition-all font-medium" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-black">Message</label>
                    <textarea 
                      rows={6} 
                      placeholder="Tell us more about your inquiry..." 
                      required 
                      value={supportForm.message}
                      onChange={(e) => setSupportForm({...supportForm, message: e.target.value})}
                      className="w-full bg-slate-50 border-0 rounded-xl py-4 px-5 focus:ring-2 focus:ring-primary-600 transition-all font-medium resize-none"
                    ></textarea>
                  </div>
                  <button 
                    type="submit" 
                    disabled={supportLoading}
                    className="w-full bg-primary-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/10 active:scale-[0.98] disabled:opacity-50"
                  >
                    {supportLoading ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactSlidePanel;
