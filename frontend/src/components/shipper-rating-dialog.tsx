import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ShipperRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  loadId: string;
  shipperId: string;
  shipperName: string;
  onRatingSubmitted?: () => void;
}

export function ShipperRatingDialog({
  open,
  onOpenChange,
  shipmentId,
  loadId,
  shipperId,
  shipperName,
  onRatingSubmitted,
}: ShipperRatingDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");

  const submitRatingMutation = useMutation({
    mutationFn: async (data: { shipperId: string; shipmentId: string; loadId: string; rating: number; review?: string }) => {
      return apiRequest("POST", "/api/shipper-ratings", data);
    },
    onSuccess: () => {
      toast({
        title: "Rating Submitted",
        description: "Thank you for your feedback!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shipper", shipperId, "rating"] });
      setRating(0);
      setReview("");
      onOpenChange(false);
      onRatingSubmitted?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Submit Rating",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a star rating.",
        variant: "destructive",
      });
      return;
    }

    submitRatingMutation.mutate({
      shipperId,
      shipmentId,
      loadId,
      rating,
      review: review.trim() || undefined,
    });
  };

  const displayRating = hoverRating || rating;

  const ratingLabels = [
    "",
    "Poor",
    "Fair",
    "Good",
    "Very Good",
    "Excellent"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-shipper-rating">
        <DialogHeader>
          <DialogTitle className="text-lg">Rate Your Experience</DialogTitle>
          <DialogDescription>
            How was your experience with {shipperName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="p-1 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  data-testid={`button-star-${star}`}
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= displayRating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            {displayRating > 0 && (
              <p className="text-sm font-medium text-muted-foreground">
                {ratingLabels[displayRating]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review">Review (Optional)</Label>
            <Textarea
              id="review"
              placeholder="Share your experience with this shipper..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="resize-none"
              rows={3}
              data-testid="textarea-review"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-rating"
          >
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || submitRatingMutation.isPending}
            data-testid="button-submit-rating"
          >
            {submitRatingMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Rating"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
