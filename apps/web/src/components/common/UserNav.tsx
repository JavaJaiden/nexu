import { SignOutButton } from "@clerk/nextjs";
import { LogOut, Paintbrush2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

interface UserNavProps {
  name: string;
  email: string;
  image?: string;
}

export function UserNav({ name, email, image }: UserNavProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={image} alt={name} />
            <AvatarFallback>
              <Image
                src="/images/profile.png"
                alt={name}
                width={32}
                height={32}
              />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-white" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none text-black">
              {name}
            </p>
            <p className="text-xs leading-none text-black">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/notes">
          <DropdownMenuItem className="hover:cursor-pointer hover:bg-gray-200">
            <Paintbrush2 className="mr-2 h-4 w-4 text-black" />
            <span className="text-black">Dashboard</span>
          </DropdownMenuItem>
        </Link>
        <SignOutButton>
          <DropdownMenuItem className="hover:cursor-pointer hover:bg-gray-200">
            <LogOut className="mr-2 h-4 w-4 text-black" />
            <span className="text-black">Log out</span>
          </DropdownMenuItem>
        </SignOutButton>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
