/** TMS `layout/FullScreenLayout.vue` — chrome-free page frame (auth, errors). */
export function FullScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <main>{children}</main>
    </div>
  );
}
