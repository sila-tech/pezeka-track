import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import Products from '@/components/landing/Products';
import About from '@/components/landing/About';
import Contact from '@/components/landing/Contact';
import Footer from '@/components/landing/Footer';
import LoanCalculator from '@/components/landing/LoanCalculator';
import MobileApp from '@/components/landing/MobileApp';

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <Products />
        <LoanCalculator />
        <MobileApp />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
