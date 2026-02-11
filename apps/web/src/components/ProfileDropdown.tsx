"use client";

import { useAuth, useClerk, useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  Plus,
  Search,
  Settings,
  User as UserIcon,
  Users2,
} from "lucide-react";
import { Avatar, Button, Input, Text, XStack, YStack } from "tamagui";

type OrganizationOption = {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  role: string;
};

export default function ProfileDropdown() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { orgId } = useAuth();
  const { setActive } = useClerk();
  const { userMemberships, isLoaded: isOrgLoaded } = useOrganizationList({
    userMemberships: {
      infinite: true,
      pageSize: 100,
    },
  });

  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const organizations = useMemo<OrganizationOption[]>(() => {
    const memberships = userMemberships?.data ?? [];
    const normalized: OrganizationOption[] = [];

    for (const membership of memberships) {
      const membershipData = membership as any;
      const organization = membershipData.organization ?? membershipData.publicOrganizationData;
      if (!organization || typeof organization.id !== "string") continue;

      normalized.push({
        id: organization.id,
        name:
          typeof organization.name === "string" && organization.name.trim().length > 0
            ? organization.name
            : "Organization",
        slug: typeof organization.slug === "string" ? organization.slug : undefined,
        imageUrl: typeof organization.imageUrl === "string" ? organization.imageUrl : undefined,
        role: String(membershipData.role ?? "member"),
      });
    }

    return normalized;
  }, [userMemberships?.data]);

  const filteredOrganizations = useMemo(() => {
    if (!searchTerm) return organizations;
    return organizations.filter((organization) =>
      organization.name.toLowerCase().includes(searchTerm)
    );
  }, [organizations, searchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim().toLowerCase());
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const onSelectOrganization = async (organizationId: string) => {
    if (organizationId === orgId) {
      setOpen(false);
      return;
    }
    setSwitchingOrgId(organizationId);
    try {
      await setActive({ organization: organizationId });
      setOpen(false);
      router.refresh();
    } catch {
      // Keep menu open if switch fails.
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "User";
  const userInitial = userName.charAt(0).toUpperCase() || "U";

  return (
    <YStack position="relative">
      <Button
        ref={triggerRef}
        size="$3"
        backgroundColor="transparent"
        borderWidth={1}
        borderColor="$border"
        borderRadius="$full"
        padding={0}
        width={34}
        height={34}
        onPress={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user?.imageUrl ? (
          <Avatar circular size="$3">
            <Avatar.Image src={user.imageUrl} />
            <Avatar.Fallback backgroundColor="$backgroundSecondary" />
          </Avatar>
        ) : (
          <YStack
            width={30}
            height={30}
            borderRadius={15}
            alignItems="center"
            justifyContent="center"
            backgroundColor="$backgroundSecondary"
          >
            <Text fontSize={13} fontWeight="600" color="$color">
              {userInitial}
            </Text>
          </YStack>
        )}
      </Button>

      {open && (
        <YStack
          ref={menuRef}
          role="menu"
          position="absolute"
          top={42}
          right={0}
          width={280}
          maxWidth="calc(100vw - 24px)"
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$border"
          borderRadius="$lg"
          padding="$sm"
          gap="$xs"
          zIndex={500}
          style={{
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.22)",
          }}
        >
          <XStack alignItems="center" gap="$sm" padding="$xs" borderRadius="$md">
            {user?.imageUrl ? (
              <Avatar circular size="$3">
                <Avatar.Image src={user.imageUrl} />
                <Avatar.Fallback backgroundColor="$backgroundSecondary" />
              </Avatar>
            ) : (
              <YStack
                width={28}
                height={28}
                borderRadius={14}
                alignItems="center"
                justifyContent="center"
                backgroundColor="$backgroundSecondary"
              >
                <Text fontSize={12} fontWeight="600" color="$color">
                  {userInitial}
                </Text>
              </YStack>
            )}
            <YStack flex={1}>
              <Text fontSize={13} fontWeight="600" color="$color" numberOfLines={1}>
                {userName}
              </Text>
              <Text fontSize={11} color="$textMuted" numberOfLines={1}>
                {user?.primaryEmailAddress?.emailAddress ?? ""}
              </Text>
            </YStack>
          </XStack>

          <XStack
            alignItems="center"
            gap="$xs"
            paddingHorizontal="$sm"
            paddingVertical="$xs"
            borderWidth={1}
            borderColor="$border"
            borderRadius="$md"
            backgroundColor="$backgroundSecondary"
          >
            <Search size={14} color="currentColor" />
            <Input
              flex={1}
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search organizations"
              backgroundColor="transparent"
              borderWidth={0}
              color="$color"
              placeholderTextColor="$textMuted"
              padding="$xs"
              fontSize={13}
            />
          </XStack>

          <YStack maxHeight={180} overflow="scroll" gap="$xs">
            {filteredOrganizations.length === 0 ? (
              <Text fontSize={12} color="$textMuted" padding="$sm">
                No organizations found
              </Text>
            ) : (
              filteredOrganizations.map((organization) => {
                const active = organization.id === orgId;
                const pending = switchingOrgId === organization.id;
                return (
                  <Button
                    key={organization.id}
                    size="$3"
                    justifyContent="space-between"
                    backgroundColor={active ? "$backgroundSecondary" : "transparent"}
                    borderWidth={1}
                    borderColor={active ? "$borderStrong" : "transparent"}
                    color="$color"
                    onPress={() => onSelectOrganization(organization.id)}
                    disabled={pending}
                    icon={<Users2 size={14} color="currentColor" />}
                    role="menuitem"
                  >
                    <XStack alignItems="center" justifyContent="space-between" width="100%">
                      <Text fontSize={13} color="$color" numberOfLines={1}>
                        {organization.name}
                      </Text>
                      {active ? <Check size={14} color="currentColor" /> : null}
                    </XStack>
                  </Button>
                );
              })
            )}
          </YStack>

          <Button
            size="$3"
            justifyContent="flex-start"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="transparent"
            color="$color"
            onPress={() => navigate("/organizations")}
            icon={<Building2 size={14} color="currentColor" />}
            role="menuitem"
          >
            All organizations
          </Button>

          <YStack height={1} backgroundColor="$border" marginVertical="$xs" />

          <Button
            size="$3"
            justifyContent="flex-start"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="transparent"
            color="$color"
            onPress={() => navigate("/settings/organization/general")}
            icon={<Building2 size={14} color="currentColor" />}
            role="menuitem"
          >
            Organization home
          </Button>

          <Button
            size="$3"
            justifyContent="flex-start"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="transparent"
            color="$color"
            onPress={() => navigate("/settings/profile")}
            icon={<UserIcon size={14} color="currentColor" />}
            role="menuitem"
          >
            Account settings
          </Button>

          <Button
            size="$3"
            justifyContent="flex-start"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="transparent"
            color="$color"
            onPress={() => navigate("/settings/organization/general")}
            icon={<Settings size={14} color="currentColor" />}
            role="menuitem"
          >
            Organization settings
          </Button>

          <YStack height={1} backgroundColor="$border" marginVertical="$xs" />

          <Button
            size="$3"
            justifyContent="flex-start"
            backgroundColor="transparent"
            borderWidth={1}
            borderColor="transparent"
            color="$color"
            onPress={() => navigate("/organizations/new")}
            icon={<Plus size={14} color="currentColor" />}
            role="menuitem"
          >
            Add organization
          </Button>

          {!isUserLoaded || !isOrgLoaded ? (
            <Text fontSize={11} color="$textMuted" paddingHorizontal="$xs">
              Loading organizations...
            </Text>
          ) : null}
        </YStack>
      )}
    </YStack>
  );
}
