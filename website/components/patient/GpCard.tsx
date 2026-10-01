import { CheckIcon, StarIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MatchedGp } from '@/lib/booking-flow';
import { formatRating, publicRating, ratingsLabel } from '@/lib/rating-rules';

// The payoff of the request, and the one band on its screen: the driver card
// of a ride app without the face or the name, neither of which this card may
// show. The trust it offers is the reference, the registration, why this GP
// was the one matched, and (since 2026-10-01) the average rating patients have
// given them, shown only once enough patients have given one.
export function GpCard({ gp, consent, status = 'Waiting for you' }: {
  gp: MatchedGp;
  consent: boolean | null;
  status?: string;
}) {
  const rating = publicRating(gp.rating);
  return (
    <Card variant="band" data-slot="gp-card" className="band-grid w-full max-w-[26rem]">
      <CardHeader>
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-white text-label text-ink">GP</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl">
              {gp.ref}
              <Badge className="bg-white/15 text-white">{status}</Badge>
            </CardTitle>
            <CardDescription>GMC-registered GP, licensed to practise in England</CardDescription>
            {rating && (
              <p data-slot="gp-rating" className="mt-1 flex flex-wrap items-center gap-x-1.5 text-body">
                <StarIcon strokeWidth={2} aria-hidden="true" className="size-5 shrink-0 fill-current text-primary-lift" />
                <span className="font-semibold">{formatRating(rating.average, 1)}</span>
                <span className="text-band-muted">out of 5, from {ratingsLabel(rating.count)}</span>
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid gap-2" aria-label="Why this GP">
          {gp.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-body">
              <CheckIcon strokeWidth={2} aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-lift" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
        {gp.limitedPrescribing && (
          <p className="text-body text-band-muted">
            {consent === false
              ? `You chose not to share your NHS record, so ${gp.ref} may be unable to prescribe some treatments.`
              : `Your GP does not have your NHS record, so they may be unable to prescribe some treatments.`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
