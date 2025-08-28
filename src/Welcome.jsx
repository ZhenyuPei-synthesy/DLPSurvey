import React, { useState } from 'react';

const Welcome = ({ onNext }) => {
  const [form, setForm] = useState({
    company: '',
    department: '',
    jobTitle: '',
    name: '',
    email: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // per-field validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  const [showResumeForm, setShowResumeForm] = useState(false);
  const [resumeInputs, setResumeInputs] = useState({ email: '', answerNumber: '' });

  // In development prefer relative path so Vite proxy forwards to local Functions.
  // In production use the explicit environment variable if provided.
  const isDev = import.meta.env.MODE === 'development';
  const apiUrl = isDev
    ? '/api/CreateRespondent'
    : (import.meta.env.VITE_CREATE_RESPONDENT_API_URL || '/api/CreateRespondent');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // clear validation error for this field when user edits it
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // client-side validation for required fields
    const errors = {};
    if (!form.company || form.company.trim() === '') errors.company = '企業名は必須です。';
    if (!form.name || form.name.trim() === '') errors.name = '氏名は必須です。';
    if (!form.email || form.email.trim() === '') {
      errors.email = 'メールアドレスは必須です。';
    } else {
      const emailRe = /^\S+@\S+\.\S+$/;
      if (!emailRe.test(form.email)) errors.email = '正しいメールアドレスを入力してください。';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setIsSubmitting(false);
      return;
    }

    // apiUrl will always be defined now (fallback to same-origin), but still validate
    if (!apiUrl) {
      setError('送信先APIが設定されていません。環境変数を確認してください。');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: form.company,
          department: form.department,
          jobTitle: form.jobTitle,
          name: form.name,
          email: form.email,
          phone: form.phone
        })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`APIエラー: ${res.status} ${text}`);
      }

      const json = await res.json();
      const respondentId = json.respondentId || json.id || null;
      const answerNumber = json.answerNumber || null;
      
      // セッションストレージに回答者番号を保存
      if (respondentId) {
        sessionStorage.setItem('respondentId', respondentId.toString());
      }
      // store answerNumber and email for resume
      if (answerNumber) {
        sessionStorage.setItem('answerNumber', answerNumber.toString());
      }
      if (form.email) {
        sessionStorage.setItem('respondentEmail', form.email);
      }
      
      onNext(respondentId);
    } catch (err) {
      console.error(err);
      setError(err.message || '送信中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeToggle = () => setShowResumeForm(prev => !prev);

  const handleResumeInputChange = (e) => {
    const { name, value } = e.target;
    setResumeInputs(prev => ({ ...prev, [name]: value }));
  };

  async function domainHasMX(domain) {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`;
    const res = await fetch(url);
    if (!res.ok) return false;
    const json = await res.json();
    return Array.isArray(json.Answer) && json.Answer.some(a => a.type === 15); // 15 == MX
  }

  return (
    <div className="h-full font-sans">

      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">本アセスメントについて</h2>
          <p className="text-slate-600">AAA</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium mb-4">受検者情報</h3>
          <form onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600">会社名 <span className="text-red-600">*</span></label>
                <input name="company" aria-required="true" required value={form.company} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
                {fieldErrors.company && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.company}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600">部署名</label>
                <input name="department" value={form.department} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">役職</label>
                <input name="jobTitle" value={form.jobTitle} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">氏名 <span className="text-red-600">*</span></label>
                <input name="name" aria-required="true" required value={form.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
                {fieldErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600">メールアドレス <span className="text-red-600">*</span></label>
                <input type="email" name="email" aria-required="true" required value={form.email} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
                {fieldErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600">電話番号</label>
                <input name="phone" value={form.phone} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-4 text-right">
              <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white rounded">
                {isSubmitting ? '送信中...' : '次へ'}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t pt-4">
            <button onClick={handleResumeToggle} className="text-sm text-blue-600 underline">アセスメント再開</button>
            {showResumeForm && (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">保存したメールアドレスと回答番号を入力してアセスメントを再開できます（実際の復元は未実装）。</p>
                <div>
                  <label className="block text-sm text-slate-600">メールアドレス</label>
                  <input name="email" value={resumeInputs.email} onChange={handleResumeInputChange} className="mt-1 w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600">回答番号</label>
                  <input name="answerNumber" value={resumeInputs.answerNumber} onChange={handleResumeInputChange} className="mt-1 w-full p-2 border rounded" />
                </div>
                <div className="text-right">
                  <button className="px-4 py-2 bg-green-600 text-white rounded">再開（未実装）</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
