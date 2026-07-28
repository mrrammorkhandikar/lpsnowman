import { useState, useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAuthenticatedMediaUrl } from "@/lib/api-client";

interface AuthenticatedAvatarProps {
  src?: string | null;
  alt?: string;
  fallback: string;
  className?: string;
  fallbackClassName?: string;
}

export function AuthenticatedAvatar({
  src,
  alt,
  fallback,
  className,
  fallbackClassName,
}: AuthenticatedAvatarProps) {
  const resolvedSrc = useMemo(() => resolveAuthenticatedMediaUrl(src), [src]);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setImageBroken(false);
  }, [resolvedSrc]);

  const showImage = resolvedSrc && !imageBroken;

  return (
    <Avatar className={className}>
      {showImage ? (
        <AvatarImage
          src={resolvedSrc}
          alt={alt}
          className="object-cover"
          onError={() => setImageBroken(true)}
        />
      ) : null}
      <AvatarFallback className={fallbackClassName}>{fallback}</AvatarFallback>
    </Avatar>
  );
}
