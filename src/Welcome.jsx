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

  // In development prefer relative path so Vite proxy forwards to local Functions.
  // In production use the explicit environment variable if provided.
  const isDev = import.meta.env.MODE === 'development';
  const apiUrl = isDev
    ? '/api/CreateRespondent'
    : (import.meta.env.VITE_CREATE_RESPONDENT_API_URL || '/api/CreateRespondent');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

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
      onNext(respondentId);
    } catch (err) {
      console.error(err);
      setError(err.message || '送信中にエラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div className="relative">
        <div className="h-48 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 flex items-center">
          <div className="max-w-6xl mx-auto px-6">
            <h1 className="text-white text-3xl md:text-4xl font-extrabold">AI時代の内部情報漏洩対策アセスメント</h1>
          </div>
        </div>
      </div>

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
                <label className="block text-sm text-slate-600">会社名</label>
                <input name="company" value={form.company} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
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
                <label className="block text-sm text-slate-600">氏名</label>
                <input name="name" value={form.name} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">メールアドレス</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} className="mt-1 w-full p-2 border rounded" />
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
        </div>
      </div>
    </div>
  );
};

export default Welcome;
