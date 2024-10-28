import { Avatar, AvatarImage } from "./ui/avatar";

interface BotAvatarProps {
  src: string;
  alt: string;
}
export const BotAvatar = ({ src, alt }: BotAvatarProps) => {
  return (
    <div>
      <Avatar className="h-12 w-12" >
        <AvatarImage src={src} />
      </Avatar>
    </div>
  );
};
