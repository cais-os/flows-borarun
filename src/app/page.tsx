import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "nomore chat - Automatize suas conversas",
  description:
    "Crie fluxos inteligentes no WhatsApp com IA. Sem codigo, sem complicacao.",
};

export default function LandingPage() {
  return (
    <div className={`relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-white text-slate-900 selection:bg-black selection:text-white ${inter.className}`}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 lg:px-10 py-4">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.211 50.89 50.89 0 00-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 002.433 3.984L7.28 21.53A.75.75 0 016 21v-4.03a48.527 48.527 0 01-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979z" />
            <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 001.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0015.75 7.5z" />
          </svg>
          <h2 className="text-xl font-bold leading-tight tracking-tight">nomore chat</h2>
        </div>
        <div className="hidden lg:flex flex-1 justify-end gap-8 items-center">
          <nav className="flex items-center gap-8">
            <a className="text-sm font-medium hover:text-black transition-colors text-slate-600" href="#features">Produto</a>
            <a className="text-sm font-medium hover:text-black transition-colors text-slate-600" href="#how">Como funciona</a>
            <a className="text-sm font-medium hover:text-black transition-colors text-slate-600" href="#stats">Sobre</a>
            <a className="text-sm font-medium hover:text-black transition-colors text-slate-600" href="#cta">Contato</a>
          </nav>
          <Link href="/auth/login" className="text-sm font-medium text-slate-600 hover:text-black transition-colors">
            Entrar
          </Link>
          <Link href="/auth/signup" className="flex min-w-[84px] items-center justify-center rounded-lg h-10 px-5 bg-black text-white text-sm font-bold tracking-wide hover:bg-slate-800 transition-colors">
            Comecar Gratis
          </Link>
        </div>
        <button className="lg:hidden p-2 text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 py-20 lg:py-32 flex flex-col items-center text-center max-w-5xl mx-auto">
          <h1 className="text-5xl lg:text-7xl font-black leading-tight tracking-tighter mb-6">
            Automatize suas conversas.<br />Escale seu negocio.
          </h1>
          <p className="text-lg lg:text-xl text-slate-500 mb-10 max-w-2xl">
            Crie fluxos inteligentes no WhatsApp com IA. Sem codigo, sem complicacao.
          </p>
          <div className="flex flex-wrap gap-4 justify-center w-full mb-16">
            <Link href="/auth/signup" className="flex min-w-[140px] items-center justify-center rounded-lg h-12 px-8 bg-black text-white text-base font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-black/20">
              Comecar Agora
            </Link>
            <Link href="/auth/login" className="flex min-w-[140px] items-center justify-center rounded-lg h-12 px-8 bg-transparent border-2 border-black text-black text-base font-bold hover:bg-slate-50 transition-colors">
              Entrar
            </Link>
          </div>
          <div className="w-full relative aspect-video rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-2xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-16 h-16 text-slate-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 bg-slate-50 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-12 text-center">Tudo que voce precisa</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-black w-12 h-12 flex items-center justify-center rounded-lg bg-slate-100">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Fluxos Visuais</h3>
                  <p className="text-slate-500 leading-relaxed">Crie fluxos de conversa arrastando e soltando. Interface intuitiva que qualquer um pode usar.</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-black w-12 h-12 flex items-center justify-center rounded-lg bg-slate-100">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">IA Integrada</h3>
                  <p className="text-slate-500 leading-relaxed">Respostas automaticas inteligentes com IA avancada. Treine seu bot em minutos com seus proprios dados.</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-black w-12 h-12 flex items-center justify-center rounded-lg bg-slate-100">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Inbox Unificada</h3>
                  <p className="text-slate-500 leading-relaxed">Gerencie todas as conversas em um so lugar. Colabore com sua equipe e nunca perca uma mensagem.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-24 px-6 max-w-4xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-16 text-center">Como funciona</h2>
          <div className="flex flex-col gap-12">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="text-6xl font-black text-slate-200 w-24">01</div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Conecte seu WhatsApp</h3>
                <p className="text-slate-500 text-lg">Vincule seu numero em segundos. Sem necessidade de aprovacoes complexas.</p>
              </div>
            </div>
            <div className="w-px h-12 bg-slate-200 ml-12 hidden md:block" />
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="text-6xl font-black text-slate-200 w-24">02</div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Crie seus fluxos</h3>
                <p className="text-slate-500 text-lg">Use nosso editor visual para desenhar a jornada do cliente. Adicione condicoes, botoes e integracoes facilmente.</p>
              </div>
            </div>
            <div className="w-px h-12 bg-slate-200 ml-12 hidden md:block" />
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="text-6xl font-black text-slate-200 w-24">03</div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-2">Deixe a IA trabalhar</h3>
                <p className="text-slate-500 text-lg">Ative a IA para responder perguntas frequentes e qualificar leads enquanto voce dorme.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section id="stats" className="bg-black text-white py-20 px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-4xl lg:text-5xl font-black mb-2">+2.000</div>
              <div className="text-slate-400 font-medium">Empresas Ativas</div>
            </div>
            <div>
              <div className="text-4xl lg:text-5xl font-black mb-2">5M+</div>
              <div className="text-slate-400 font-medium">Mensagens Enviadas</div>
            </div>
            <div>
              <div className="text-4xl lg:text-5xl font-black mb-2">99.9%</div>
              <div className="text-slate-400 font-medium">Uptime Garantido</div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="py-32 px-6 flex flex-col items-center text-center">
          <div className="max-w-3xl flex flex-col items-center">
            <h2 className="text-4xl lg:text-6xl font-black tracking-tight mb-8">Pronto para transformar seu atendimento?</h2>
            <Link href="/auth/signup" className="bg-black rounded-full p-2 pl-8 flex items-center gap-4 w-full max-w-md hover:bg-slate-800 transition-colors">
              <span className="text-white font-medium flex-1 text-left">Comece agora mesmo</span>
              <span className="bg-white text-black rounded-full h-12 px-8 font-bold flex items-center justify-center">Comecar Gratis</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black text-white py-16 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.211 50.89 50.89 0 00-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 002.433 3.984L7.28 21.53A.75.75 0 016 21v-4.03a48.527 48.527 0 01-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979z" />
                <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 001.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0015.75 7.5z" />
              </svg>
              <h2 className="text-xl font-bold tracking-tight">nomore chat</h2>
            </div>
            <p className="text-slate-400 text-sm">A plataforma definitiva para automacao de WhatsApp com IA.</p>
          </div>
          <div>
            <h4 className="font-bold mb-6">Produto</h4>
            <ul className="flex flex-col gap-4 text-sm text-slate-400">
              <li><a className="hover:text-white transition-colors" href="#features">Funcionalidades</a></li>
              <li><a className="hover:text-white transition-colors" href="#how">Como funciona</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Precos</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Changelog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Empresa</h4>
            <ul className="flex flex-col gap-4 text-sm text-slate-400">
              <li><a className="hover:text-white transition-colors" href="#">Sobre nos</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Blog</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Carreiras</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Contato</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Legal</h4>
            <ul className="flex flex-col gap-4 text-sm text-slate-400">
              <li><a className="hover:text-white transition-colors" href="#">Termos de Uso</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Politica de Privacidade</a></li>
              <li><a className="hover:text-white transition-colors" href="#">Seguranca</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>&copy; 2026 nomore chat. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
