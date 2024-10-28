import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarImage } from "./ui/avatar";

export const UserAvatar = ({ alt }: { alt: string }) => {
  const { user } = useUser();
  return (
    <div>
      <Avatar className="h-12 w-12">
        <AvatarImage src={user?.imageUrl} alt={alt} />
      </Avatar>
    </div>
  );
};
