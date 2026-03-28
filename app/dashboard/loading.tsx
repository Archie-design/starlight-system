export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 animate-pulse">
      {/* Header Skeleton */}
      <header className="px-4 py-2.5 bg-slate-800 h-11 flex items-center justify-between">
        <div className="flex items-center gap-2.5 h-6 w-32 bg-slate-700/50 rounded" />
        <div className="flex gap-4 h-6 w-48 bg-slate-700/50 rounded" />
      </header>
      
      {/* Main Content Skeleton */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-[1600px] mx-auto space-y-6">
          <div className="h-8 w-40 bg-slate-200 rounded-lg mb-6" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 h-24" />
            ))}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-[400px]" />
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-[400px]" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-[250px]" />
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-[250px]" />
          </div>
        </div>
      </main>
    </div>
  )
}
