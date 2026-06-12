import { useListPractitioners, getListPractitionersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";
import heroImage from "/images/hero.png";
import { useSiteContent } from "@/hooks/useSiteContent";

export default function Home() {
  const c = useSiteContent();
  const { data: practitioners, isLoading } = useListPractitioners({ query: { queryKey: getListPractitionersQueryKey() } });

  const featuredPractitioners = practitioners?.slice(0, 3) || [];

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative w-full py-20 lg:py-32 overflow-hidden bg-background">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231531845' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}></div>
        <div className="container mx-auto px-4 md:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            <div className="flex flex-col gap-8 max-w-2xl">
              <h1 className="text-5xl lg:text-7xl font-serif leading-[1.1] text-foreground tracking-tight">
                {c("home_hero_headline", "Corporate wellbeing,")} <span className="text-primary italic">{c("home_hero_headline_2", "rooted in nature.")}</span>
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-lg">
                {c("home_hero_body", "Soulful connects forward-thinking UK corporations with vetted wellbeing practitioners. Build a culture of care through yoga, meditation, coaching, and more.")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button size="lg" className="rounded-full text-base h-14 px-8 shadow-sm" asChild>
                  <Link href="/for-corporates">{c("home_cta_primary", "Get Started for Teams")}</Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-full text-base h-14 px-8 border-primary/20 text-foreground hover:bg-primary/5" asChild>
                  <Link href="/practitioners">{c("home_cta_secondary", "Browse Practitioners")}</Link>
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground pt-4">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> {c("home_trust_1", "Vetted Experts")}</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> {c("home_trust_2", "Easy Booking")}</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> {c("home_trust_3", "Clear ROI")}</div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-[2rem] transform translate-x-4 translate-y-4 -z-10"></div>
              <img 
                src={heroImage} 
                alt="Beautiful modern wellness studio with yoga mats and natural light" 
                className="w-full h-auto object-cover rounded-[2rem] shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it Works / Value Prop */}
      <section className="py-24 bg-card border-y border-border/50">
        <div className="container mx-auto px-4 md:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-serif mb-4">A sanctuary for everyone</h2>
            <p className="text-muted-foreground text-lg">We've built a marketplace that serves both sides of the wellbeing equation with equal care.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
            <Card className="border-none shadow-md bg-background overflow-hidden group">
              <div className="h-2 bg-primary"></div>
              <CardContent className="p-8 lg:p-12 flex flex-col gap-6">
                <h3 className="text-2xl font-serif text-foreground">For Corporates</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Provide your employees with a curated directory of top-tier wellbeing practitioners. 
                  Subscribe to a plan, give your team a monthly allowance, and watch your culture transform.
                </p>
                <ul className="flex flex-col gap-3 mt-4">
                  {['Curated, vetted practitioner list', 'Simple central billing & reporting', 'Increased employee retention'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm font-medium">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="link" className="px-0 mt-auto w-fit text-primary font-semibold hover:no-underline group-hover:pl-2 transition-all" asChild>
                  <Link href="/for-corporates">Learn more <ArrowRight className="h-4 w-4 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-background overflow-hidden group">
              <div className="h-2 bg-secondary"></div>
              <CardContent className="p-8 lg:p-12 flex flex-col gap-6">
                <h3 className="text-2xl font-serif text-foreground">For Practitioners</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Focus on healing, not marketing. Join our directory to get your services in front of 
                  engaged corporate clients looking for exactly what you offer.
                </p>
                <ul className="flex flex-col gap-3 mt-4">
                  {['Access to high-value corporate clients', 'Integrated calendar & booking', 'Keep 100% of your session rate'].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm font-medium">
                      <div className="h-6 w-6 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-3 w-3 text-secondary" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="link" className="px-0 mt-auto w-fit text-secondary font-semibold hover:no-underline group-hover:pl-2 transition-all" asChild>
                  <Link href="/for-practitioners">Join the directory <ArrowRight className="h-4 w-4 ml-1" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Featured Practitioners */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="text-3xl lg:text-4xl font-serif mb-4">Meet our practitioners</h2>
              <p className="text-muted-foreground text-lg max-w-xl">Vetted professionals dedicated to bringing calm and clarity to your team.</p>
            </div>
            <Button variant="outline" className="rounded-full shrink-0" asChild>
              <Link href="/practitioners">View all practitioners</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-muted rounded-2xl h-[400px]"></div>
              ))
            ) : featuredPractitioners.length > 0 ? (
              featuredPractitioners.map((practitioner) => (
                <Link key={practitioner.id} href={`/practitioners/${practitioner.id}`}>
                  <Card className="h-full border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-card overflow-hidden group">
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      {practitioner.avatarUrl ? (
                        <img 
                          src={practitioner.avatarUrl} 
                          alt={practitioner.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-serif text-4xl">
                          {practitioner.name.charAt(0)}
                        </div>
                      )}
                      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-foreground">
                        {practitioner.specialism}
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-serif text-xl font-medium">{practitioner.name}</h3>
                        {practitioner.averageRating && (
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Star className="h-4 w-4 fill-secondary text-secondary" />
                            {practitioner.averageRating.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{practitioner.bio}</p>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                        <span className="font-medium">£{practitioner.sessionRateGbp} <span className="text-muted-foreground font-normal text-sm">/ session</span></span>
                        <span className="text-primary text-sm font-medium flex items-center">
                          Book <ArrowRight className="h-4 w-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No practitioners found.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-primary text-primary-foreground text-center px-4">
        <div className="container mx-auto max-w-3xl flex flex-col items-center gap-8">
          <h2 className="text-4xl lg:text-5xl font-serif">Ready to transform your workplace?</h2>
          <p className="text-primary-foreground/80 text-lg lg:text-xl">
            Join the companies prioritizing mental and physical wellbeing. A healthier team is a more creative, resilient team.
          </p>
          <Button size="lg" variant="secondary" className="rounded-full text-base h-14 px-8 mt-4" asChild>
            <Link href="/for-corporates">Get Started Today</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
