import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useListLocations } from "@workspace/api-client-react";
import { MapPin, Users, Wifi, Building2, Trees, Hotel, MonitorPlay, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  studio:   { label: "Studio",   icon: <Building2 className="w-4 h-4" />,    color: "bg-sage-100 text-sage-800" },
  office:   { label: "Office",   icon: <Building2 className="w-4 h-4" />,    color: "bg-amber-100 text-amber-800" },
  outdoor:  { label: "Outdoor",  icon: <Trees className="w-4 h-4" />,        color: "bg-green-100 text-green-800" },
  virtual:  { label: "Virtual",  icon: <MonitorPlay className="w-4 h-4" />,  color: "bg-blue-100 text-blue-800" },
  hotel:    { label: "Hotel",    icon: <Hotel className="w-4 h-4" />,        color: "bg-rose-100 text-rose-800" },
};

const TYPE_FILTERS = ["All", "studio", "office", "outdoor", "virtual", "hotel"];

export default function Locations() {
  const { data: locations, isLoading } = useListLocations();
  const [activeType, setActiveType] = useState("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = (locations ?? []).filter(
    (l) => activeType === "All" || l.type === activeType
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-card border-b">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 30% 60%, hsl(var(--primary)) 0%, transparent 60%), radial-gradient(circle at 80% 20%, hsl(var(--accent)) 0%, transparent 50%)" }}
        />
        <div className="container mx-auto px-4 md:px-8 py-20 md:py-28 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <Badge variant="outline" className="mb-6 text-primary border-primary/30 bg-primary/5 px-4 py-1 rounded-full text-xs font-medium tracking-wide uppercase">
              Event Venues
            </Badge>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Spaces built for<br />
              <span className="text-primary">real wellbeing</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Every session deserves a setting that supports it. Browse our network of vetted venues across London — studios, corporate suites, outdoor spaces, and premium virtual rooms.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 md:px-8 py-3 flex gap-2 overflow-x-auto scrollbar-none">
          {TYPE_FILTERS.map((type) => {
            const meta = TYPE_META[type];
            const isActive = activeType === type;
            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {meta && <span>{meta.icon}</span>}
                {type === "All" ? "All Spaces" : meta?.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-4 md:px-8 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border h-64 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            No venues found for this category.
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((loc, i) => {
                const meta = TYPE_META[loc.type] ?? TYPE_META.studio;
                const isOpen = expanded === loc.id;

                return (
                  <motion.div
                    key={loc.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                  >
                    <Card
                      className={`overflow-hidden group cursor-pointer border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${isOpen ? "ring-2 ring-primary/30" : ""}`}
                      onClick={() => setExpanded(isOpen ? null : loc.id)}
                    >
                      {/* Colour band by type */}
                      <div className={`h-2 w-full ${
                        loc.type === "studio" ? "bg-gradient-to-r from-primary to-accent" :
                        loc.type === "office" ? "bg-gradient-to-r from-amber-400 to-orange-400" :
                        loc.type === "outdoor" ? "bg-gradient-to-r from-green-400 to-emerald-500" :
                        loc.type === "virtual" ? "bg-gradient-to-r from-blue-400 to-indigo-500" :
                        "bg-gradient-to-r from-rose-400 to-pink-400"
                      }`} />

                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <h3 className="font-serif font-semibold text-lg text-foreground leading-tight group-hover:text-primary transition-colors">
                              {loc.name}
                            </h3>
                            {loc.type !== "virtual" && (
                              <div className="flex items-center gap-1 mt-1 text-muted-foreground text-xs">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span>{loc.city} · {loc.postcode}</span>
                              </div>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border-0 ${
                              loc.type === "studio" ? "bg-primary/10 text-primary" :
                              loc.type === "office" ? "bg-amber-100 text-amber-700" :
                              loc.type === "outdoor" ? "bg-green-100 text-green-700" :
                              loc.type === "virtual" ? "bg-blue-100 text-blue-700" :
                              "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {meta.icon}
                            {meta.label}
                          </Badge>
                        </div>

                        {/* Capacity */}
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                          <Users className="w-4 h-4" />
                          <span>Capacity: <strong className="text-foreground">{loc.capacity}</strong> {loc.type === "virtual" ? "participants" : "people"}</span>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                          {loc.description}
                        </p>

                        {/* Expand toggle */}
                        <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-80" : "max-h-0"}`}>
                          {loc.amenities && loc.amenities.length > 0 && (
                            <div className="pt-4 border-t mt-2">
                              <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Included</p>
                              <div className="flex flex-wrap gap-1.5">
                                {loc.amenities.map((a) => (
                                  <span
                                    key={a}
                                    className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1"
                                  >
                                    <span className="w-1 h-1 rounded-full bg-primary inline-block" />
                                    {a}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                          <button
                            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : loc.id); }}
                          >
                            {isOpen ? "Show less" : "View amenities"}
                            <ChevronRight className={`w-3 h-3 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          </button>
                          <Button
                            size="sm"
                            className="rounded-full text-xs px-4"
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link href="/practitioners">Book a session here</Link>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-16 rounded-2xl bg-primary/5 border border-primary/20 p-10 text-center"
        >
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-3">
            Need a bespoke space?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            We work with venues across the UK to find the right setting for your team's wellbeing programme. Get in touch and we'll arrange it for you.
          </p>
          <Button className="rounded-full px-8" asChild>
            <Link href="/for-corporates">Talk to us</Link>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
