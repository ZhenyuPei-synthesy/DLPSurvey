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
  const [resumeError, setResumeError] = useState(null);
  const [isResuming, setIsResuming] = useState(false);

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
      // store companyName, answerNumber and email for resume/report
      if (form.company) {
        sessionStorage.setItem('companyName', form.company);
      }
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

  const handleResumeSubmit = async (e) => {
    e.preventDefault();
    setIsResuming(true);
    setResumeError(null);

    if (!resumeInputs.email || !resumeInputs.answerNumber) {
      setResumeError('メールアドレスとアセスメント番号を入力してください。');
      setIsResuming(false);
      return;
    }

    const resumeApiUrl = isDev
      ? '/api/ResumeSurvey'
      : (import.meta.env.VITE_RESUME_SURVEY_API_URL || '/api/ResumeSurvey');

    try {
      const res = await fetch(resumeApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resumeInputs.email,
          answerNumber: resumeInputs.answerNumber
        })
      });

        // parse response safely: prefer JSON, but fall back to text when not JSON
        let json;
        if (!res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'アセスメントの再開に失敗しました');
          } else {
            const txt = await res.text();
            throw new Error(txt || `APIエラー: ${res.status}`);
          }
        }

        // OK response: try parse JSON, else throw
        try {
          json = await res.json();
        } catch (e) {
          const txt = await res.text();
          throw new Error(txt || 'レスポンスの解析に失敗しました');
        }
      
      // 回答済みの場合は専用メッセージを表示
      if (json.completed) {
        setResumeError(json.error || 'このアセスメントは既に回答が完了しています。');
        setIsResuming(false);
        return;
      }
      
      const respondentId = json.respondentId;
      
      if (respondentId) {
        // セッションストレージにデータを設定
        sessionStorage.setItem('respondentId', respondentId.toString());
        sessionStorage.setItem('answerNumber', resumeInputs.answerNumber);
        sessionStorage.setItem('respondentEmail', resumeInputs.email);

        // アセスメントを再開
        onNext(respondentId);
      } else {
        throw new Error('回答者IDが取得できませんでした');
      }
    } catch (err) {
      console.error(err);
      setResumeError(err.message || 'アンケートの再開中にエラーが発生しました');
    } finally {
      setIsResuming(false);
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
          <h2 className="text-xl font-semibold mb-4">背景と目的</h2>
          <p className="text-slate-600 mb-4">
            データ保護は、企業の競争力や社会的信用を維持する上で不可欠な経営課題です。特に生成AIの普及は、意図しない形での情報漏洩という、これまで想定されなかった新たな脅威を生んでいます。
          </p>

          <p className="text-slate-600 mb-4">
            本アセスメントは、AI時代における貴社の情報管理体制の現状を正確に把握することを目的としています。客観的な評価を通じて課題を可視化し、AIを安全に活用できるセキュリティ体制の構築を支援します。
          </p>

          <p className="text-slate-600 mb-4">
            組織全体の状況を正確に把握するため、貴社のIT・人事・法務部門等のご協力を想定しています。
          </p>

          <h3 className="text-lg font-medium mb-3">本アセスメントの作成方法について</h3>
          <p className="text-slate-600 mb-3">
            客観性と信頼性を担保するため、以下の公的な指針に基づき設計しています。
          </p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-2">
            <li>
              <strong>経済産業省「営業秘密管理指針」</strong>
              <div className="text-sm text-slate-500">営業秘密管理の基本ルールが実践されているかを確認します。</div>
            </li>
            <li>
              <strong>IPA「組織における内部不正防止ガイドライン」</strong>
              <div className="text-sm text-slate-500">情報管理ルールの理解度や、不正を抑制する組織風土を把握します。</div>
            </li>
          </ul>

          <p className="text-slate-600 mb-4">
            これらの公的文書を拠り所とすることで、AI時代の脅威に対応する網羅的かつ実践的な現状評価が可能となります。
          </p>

          <h3 className="text-lg font-medium mb-3">ご協力いただいた企業様への特典</h3>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li>
              <strong>AIによる簡易診断レポート</strong>
              <div className="text-sm text-slate-500">回答後すぐに、現状の強みと課題をまとめたレポートをダウンロードいただけます。</div>
            </li>
            <li>
              <strong>専門家による詳細な改善提案</strong>
              <div className="text-sm text-slate-500">ご希望の企業様には、専門家が結果を分析し、改善策とロードマップをご提案します。</div>
            </li>
            <li>
              <strong>業界ベンチマークレポートのご提供</strong>
              <div className="text-sm text-slate-500">統計利用にご協力いただける企業様には、3ヶ月後に業界ベンチマークレポートを無償でご提供します。</div>
            </li>
          </ul>

          <p className="text-slate-600 mt-4">
            AI技術の恩恵を安全に享受し、貴社の持続的成長を守るため、本アセスメントの趣旨にご理解とご協力をいただけますようお願い申し上げます。
          </p>
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
                <p className="text-sm text-slate-600">保存したメールアドレスとアセスメント番号を入力してアセスメントを再開できます。</p>
                <form onSubmit={handleResumeSubmit}>
                  <div>
                    <label className="block text-sm text-slate-600">メールアドレス</label>
                    <input 
                      type="email" 
                      name="email" 
                      value={resumeInputs.email} 
                      onChange={handleResumeInputChange} 
                      className="mt-1 w-full p-2 border rounded" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600">アセスメント番号</label>
                    <input 
                      name="answerNumber" 
                      value={resumeInputs.answerNumber} 
                      onChange={handleResumeInputChange} 
                      className="mt-1 w-full p-2 border rounded" 
                      required 
                    />
                  </div>
                  {resumeError && (
                    <p className="mt-2 text-sm text-red-600">{resumeError}</p>
                  )}
                  <div className="text-right mt-3">
                    <button 
                      type="submit" 
                      disabled={isResuming}
                      className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
                    >
                      {isResuming ? '再開中...' : '再開'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
