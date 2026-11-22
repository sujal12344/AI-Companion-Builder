import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Companion } from "@prisma/client";

interface CompanionCardProps {
  item: Companion & {
    _count: {
      messages: number;
    };
  };
  userId?: string | null;
}

const CompanionCard = ({ item, userId }: CompanionCardProps) => {
  const isUserLoggedin = () => {
    return !!userId;
  };

  return (
    <Card
      className="bg-primary/10 rounded-xl cursor-pointer hover:opacity-75 transition border-0 flex flex-col justify-between h-full overflow-hidden"
      key={item.id}
    >
      <Link
        href={isUserLoggedin() ? `/chat/${item.id}` : "/sign-in"}
        className="flex flex-1 flex-col justify-between h-full min-h-[300px]"
      >
        <CardHeader className="flex flex-col items-center justify-start text-center text-muted-foreground p-4 pb-2 space-y-2 flex-1">
          <div className="relative w-32 h-32 shrink-0">
            <Image
              fill
              src={item.img}
              alt={item.name}
              className="rounded-xl object-cover"
              sizes="128px"
            />
          </div>
          <p className="font-bold text-foreground line-clamp-1 w-full px-1 h-5 flex items-center justify-center">
            {item.name}
          </p>
          <div className="w-full px-1 min-h-[2.5rem] flex items-center justify-center">
            <p className="text-xs text-muted-foreground line-clamp-2 text-center leading-relaxed">
              {item.description}
            </p>
          </div>
        </CardHeader>
        <CardFooter className="flex items-center text-xs justify-between text-muted-foreground px-4 pb-4 pt-2 w-full mt-auto">
          <p className="font-semibold truncate max-w-[100px]">@{item.userName}</p>
          <div className="flex items-center shrink-0">
            <MessageSquare className="w-4 h-4 mr-1" />
            {item._count.messages}
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
};

export default CompanionCard;
