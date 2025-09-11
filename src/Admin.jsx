import React, { useState } from 'react';
import PowerBIReport from './PowerBIReport';
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";

// Component shown when user is not authenticated
function Login() {
    const { instance } = useMsal();

    const handleLogin = () => {
        instance.loginPopup(loginRequest).catch(e => {
            console.error(e);
        });
    };

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-4">管理者ログイン</h1>
                <p className="mb-6">このページにアクセスするにはログインが必要です。</p>
                <button
                    onClick={handleLogin}
                    className="px-6 py-2 text-lg font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-sm"
                >
                    ログイン
                </button>
            </div>
        </div>
    );
}

// The content of the admin page for authenticated users
function AdminDashboard() {
  const [page, setPage] = useState('admin');

  if (page === 'powerbi') {
    return <PowerBIReport onBack={() => setPage('admin')} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">管理画面</h2>
      <div className="space-y-4">
        <button
          onClick={() => setPage('powerbi')}
          className="px-4 py-2 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-sm"
        >
          ダッシュボード
        </button>
        {/* 他の管理機能ボタンをここに追加できます */}
      </div>
    </div>
  );
}

// Main Admin component that handles authentication
function Admin() {
  return (
    <>
      <AuthenticatedTemplate>
        <AdminDashboard />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </>
  );
}

export default Admin;