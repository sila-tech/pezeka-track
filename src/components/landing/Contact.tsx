import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function Contact() {
  return (
    <section id="contact" className="w-full py-12 md:py-24 lg:py-32 bg-muted">
      <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
            Get in Touch
          </h2>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            Have questions? We'd love to hear from you. Fill out the form below or reach out to us directly.
          </p>
        </div>
        <div className="mx-auto w-full max-w-2xl grid md:grid-cols-2 gap-8">
          <div className="space-y-4 text-left">
             <h3 className="text-xl font-bold">Contact Information</h3>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Address:</strong> Nairobi, Kenya</p>
                <p><strong>Phone:</strong> 0757664047</p>
                <p><strong>Email:</strong> pezekalimited@gmail.com</p>
             </div>
          </div>
          <div className="space-y-4 text-left">
            <h3 className="text-xl font-bold">Send us a Message</h3>
            <form className="space-y-4">
              <Input type="text" placeholder="Name" className="w-full" />
              <Input type="email" placeholder="Email" className="w-full" />
              <Textarea placeholder="Your Message" className="w-full" />
              <Button type="submit" className="w-full">Send Message</Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
