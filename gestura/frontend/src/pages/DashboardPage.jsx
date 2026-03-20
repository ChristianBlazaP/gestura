import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-green-50 text-gray-800">
      <div className="h-14 flex items-center justify-between px-4">
        <button onClick={() => nav(-1)} className="px-3 py-1.5 rounded-lg border border-green-200 text-sm text-green-800 hover:bg-green-100">Back</button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white bg-opacity-60 backdrop-blur-lg p-8 rounded-2xl shadow-lg text-center">
          <h1 className="text-3xl font-bold text-green-700 mb-4">Welcome!</h1>
          <p className="text-lg">You have successfully logged in.</p>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              window.location.href = "/";
            }}
            className="mt-6 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
