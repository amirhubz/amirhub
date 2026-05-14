import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Page Not Found</h2>
      <p className="text-neutral-500 mb-8">Could not find requested resource</p>
      <Link 
        href="/"
        className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-neutral-800 transition-all"
      >
        Return Home
      </Link>
    </div>
  );
}
