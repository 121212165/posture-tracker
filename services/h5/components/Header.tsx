interface HeaderProps {
  studioName: string;
  studioLogo?: string | null;
}

export function Header({ studioName, studioLogo }: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-primary-600 to-pink-600 text-white">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="flex items-center gap-3">
          {studioLogo ? (
            <img src={studioLogo} alt={studioName} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-lg font-bold">{studioName.charAt(0)}</span>
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold">{studioName}</h1>
            <p className="text-xs text-white/80">体态评估报告</p>
          </div>
        </div>
      </div>
    </header>
  );
}
