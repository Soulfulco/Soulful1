import { useState } from "react";
import { useListPractitioners, getListPractitionersQueryKey, useListSpecialisms, getListSpecialismsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Star, Filter } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function Practitioners() {
  const [search, setSearch] = useState("");
  const [specialism, setSpecialism] = useState<string>("");

  const { data: specialisms } = useListSpecialisms({
    query: { queryKey: getListSpecialismsQueryKey() }
  });
  const SPECIALISMS = (specialisms ?? []).map((s) => s.name);

  const { data: practitioners, isLoading } = useListPractitioners(
    { search: search || undefined, specialism: specialism || undefined },
    { query: { queryKey: getListPractitionersQueryKey({ search: search || undefined, specialism: specialism || undefined }) } }
  );

  return (
    <div className="container mx-auto px-4 md:px-8 py-12">
      <div className="max-w-3xl mb-12">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-6 tracking-tight">Find your guide</h1>
        <p className="text-xl text-muted-foreground">
          Discover vetted professionals dedicated to bringing calm and clarity to your corporate team.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        <div className="w-full lg:w-1/3 xl:w-1/4 flex flex-col gap-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name..." 
              className="pl-9 h-12 bg-background border-border"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-card border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-foreground font-serif text-lg">
              <Filter className="h-5 w-5" /> Specialism
            </div>
            <ToggleGroup 
              type="single" 
              value={specialism} 
              onValueChange={(val) => setSpecialism(val)}
              className="flex flex-col items-start gap-2"
            >
              <ToggleGroupItem value="" className="w-full justify-start rounded-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                All Practitioners
              </ToggleGroupItem>
              {SPECIALISMS.map(spec => (
                <ToggleGroupItem 
                  key={spec} 
                  value={spec} 
                  className="w-full justify-start capitalize rounded-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {spec}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="w-full lg:w-2/3 xl:w-3/4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {isLoading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse bg-muted rounded-2xl h-[400px]"></div>
              ))
            ) : practitioners?.length ? (
              practitioners.map((practitioner) => (
                <Link key={practitioner.id} href={`/practitioners/${practitioner.id}`}>
                  <Card className="h-full border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-card overflow-hidden group">
                    <div className="aspect-square bg-muted relative overflow-hidden">
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
                      <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-foreground capitalize">
                        {practitioner.specialism}
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-serif text-xl font-medium">{practitioner.name}</h3>
                        {practitioner.averageRating != null && (
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Star className="h-4 w-4 fill-secondary text-secondary" />
                            {practitioner.averageRating.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-4">{practitioner.bio}</p>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                        <span className="font-medium text-foreground">£{practitioner.sessionRateGbp} <span className="text-muted-foreground font-normal text-sm">/ session</span></span>
                        <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 hover:text-primary">
                          View profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-card rounded-2xl border">
                <h3 className="text-xl font-serif mb-2">No practitioners found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your search or specialism filters.</p>
                <Button variant="outline" onClick={() => { setSearch(""); setSpecialism(""); }}>Clear all filters</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
