"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, H1, Paragraph, Text, XStack, YStack, Input } from "tamagui";
import Header from "@/components/Header";

type OrganizationMembership = {
  role: "owner" | "admin" | "member";
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string;
  };
};

type OrganizationMember = {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type OrganizationInvitation = {
  id: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
};

type MembersPayload = {
  role: "owner" | "admin" | "member";
  members: OrganizationMember[];
  invitations: OrganizationInvitation[];
};

export default function OrganizationsPage() {
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("");
  const [membersData, setMembersData] = useState<MembersPayload | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const selectedMembership = useMemo(
    () => organizations.find((entry) => entry.organization.id === selectedOrganizationId) ?? null,
    [organizations, selectedOrganizationId]
  );

  const canInvite = useMemo(
    () => selectedMembership?.role === "owner" || selectedMembership?.role === "admin",
    [selectedMembership?.role]
  );

  const loadOrganizations = useCallback(async () => {
    const res = await fetch("/api/settings/organizations", { cache: "no-store" });
    const payload = (await res.json()) as {
      organizations?: OrganizationMembership[];
      error?: string;
    };
    if (!res.ok) {
      throw new Error(payload.error || "Failed to load organizations.");
    }
    const orgs = Array.isArray(payload.organizations) ? payload.organizations : [];
    setOrganizations(orgs);
    setSelectedOrganizationId((current) => {
      if (current && orgs.some((entry) => entry.organization.id === current)) return current;
      return orgs[0]?.organization.id ?? "";
    });
  }, []);

  const loadMembers = useCallback(async (organizationId: string) => {
    if (!organizationId) {
      setMembersData(null);
      return;
    }
    setMembersLoading(true);
    try {
      const res = await fetch(
        `/api/settings/organization/members?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" }
      );
      const payload = (await res.json()) as MembersPayload & { error?: string };
      if (!res.ok) throw new Error(payload.error || "Failed to load organization members.");
      setMembersData({
        role: payload.role,
        members: Array.isArray(payload.members) ? payload.members : [],
        invitations: Array.isArray(payload.invitations) ? payload.invitations : [],
      });
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadOrganizations();
      } catch (error) {
        if (!cancelled) {
          setNotice({
            kind: "error",
            text: error instanceof Error ? error.message : "Failed to load organizations.",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOrganizations]);

  useEffect(() => {
    if (!selectedOrganizationId) {
      setMembersData(null);
      return;
    }
    void loadMembers(selectedOrganizationId).catch((error) => {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to load organization members.",
      });
    });
  }, [selectedOrganizationId, loadMembers]);

  const inviteFriend = async () => {
    if (!selectedOrganizationId) return;
    if (!inviteEmail.trim()) {
      setNotice({ kind: "error", text: "Invite email is required." });
      return;
    }
    setInviting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/organization/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: selectedOrganizationId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to send invitation.");
      }
      setInviteEmail("");
      await loadMembers(selectedOrganizationId);
      setNotice({ kind: "success", text: "Invitation sent." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to send invitation.",
      });
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <YStack flex={1} backgroundColor="$background" minHeight="100vh">
        <Header />
        <YStack padding="$lg" maxWidth={1200} width="100%" marginHorizontal="auto" gap="$sm">
          <H1 fontSize={30}>Organizations</H1>
          <Paragraph color="$textMuted">Loading organizations...</Paragraph>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" minHeight="100vh">
      <Header />
      <YStack padding="$lg" maxWidth={1200} width="100%" marginHorizontal="auto" gap="$lg">
        <XStack justifyContent="space-between" alignItems="center" gap="$md" flexWrap="wrap">
          <YStack gap="$xs">
            <H1 fontSize={30} color="$color">
              Organizations
            </H1>
            <Paragraph color="$textMuted">
              Create organizations and invite friends to collaborate.
            </Paragraph>
          </YStack>
          <Link href="/organizations/new" style={{ textDecoration: "none" }}>
            <Button size="$3" backgroundColor="$color" color="$background">
              New organization
            </Button>
          </Link>
        </XStack>

        {notice && (
          <XStack
            padding="$sm"
            borderRadius="$md"
            borderWidth={1}
            borderColor={notice.kind === "success" ? "$success" : "$error"}
            backgroundColor={notice.kind === "success" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"}
          >
            <Text fontSize={13} color={notice.kind === "success" ? "$success" : "$error"}>
              {notice.text}
            </Text>
          </XStack>
        )}

        {organizations.length === 0 ? (
          <YStack
            gap="$md"
            padding="$lg"
            borderRadius="$lg"
            borderWidth={1}
            borderColor="$border"
            backgroundColor="$backgroundSecondary"
          >
            <Text fontSize={16} color="$color" fontWeight="600">
              No organizations yet
            </Text>
            <Paragraph color="$textMuted">
              Create your first organization and start inviting friends.
            </Paragraph>
            <Link href="/organizations/new" style={{ textDecoration: "none" }}>
              <Button size="$3" backgroundColor="$color" color="$background" alignSelf="flex-start">
                Create organization
              </Button>
            </Link>
          </YStack>
        ) : (
          <XStack gap="$lg" alignItems="flex-start" flexWrap="wrap">
            <YStack
              gap="$sm"
              width={320}
              minWidth={280}
              padding="$lg"
              borderRadius="$lg"
              borderWidth={1}
              borderColor="$border"
              backgroundColor="$backgroundSecondary"
            >
              <Text fontSize={15} fontWeight="600" color="$color">
                Your organizations
              </Text>
              {organizations.map((entry) => {
                const active = entry.organization.id === selectedOrganizationId;
                return (
                  <Button
                    key={entry.organization.id}
                    size="$3"
                    justifyContent="space-between"
                    backgroundColor={active ? "$background" : "transparent"}
                    borderWidth={1}
                    borderColor={active ? "$borderStrong" : "$border"}
                    onPress={() => setSelectedOrganizationId(entry.organization.id)}
                  >
                    <XStack justifyContent="space-between" width="100%">
                      <Text color="$color">{entry.organization.name}</Text>
                      <Text color="$textMuted" fontSize={12}>
                        {entry.role}
                      </Text>
                    </XStack>
                  </Button>
                );
              })}
            </YStack>

            <YStack flex={1} minWidth={320} gap="$lg">
              <YStack
                gap="$md"
                padding="$lg"
                borderRadius="$lg"
                borderWidth={1}
                borderColor="$border"
                backgroundColor="$backgroundSecondary"
              >
                <Text fontSize={16} fontWeight="600" color="$color">
                  Invite friends
                </Text>
                <Paragraph color="$textMuted">
                  Invite teammates by email to join{" "}
                  <Text color="$color">{selectedMembership?.organization.name ?? "this organization"}</Text>.
                </Paragraph>
                <XStack gap="$sm" alignItems="center" flexWrap="wrap">
                  <Input
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    placeholder="friend@example.com"
                    width={260}
                    backgroundColor="$background"
                    borderColor="$border"
                    disabled={!canInvite}
                  />
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.currentTarget.value as "member" | "admin")
                    }
                    disabled={!canInvite}
                    style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button
                    size="$3"
                    backgroundColor="$color"
                    color="$background"
                    onPress={inviteFriend}
                    disabled={!canInvite || inviting}
                  >
                    {inviting ? "Inviting..." : "Send invite"}
                  </Button>
                </XStack>
                {!canInvite && (
                  <Paragraph color="$textMuted">
                    You need owner or admin permissions to invite people.
                  </Paragraph>
                )}
              </YStack>

              <YStack
                gap="$md"
                padding="$lg"
                borderRadius="$lg"
                borderWidth={1}
                borderColor="$border"
                backgroundColor="$backgroundSecondary"
              >
                <Text fontSize={16} fontWeight="600" color="$color">
                  Members
                </Text>
                {membersLoading ? (
                  <Paragraph color="$textMuted">Loading members...</Paragraph>
                ) : membersData?.members?.length ? (
                  membersData.members.map((member) => (
                    <XStack
                      key={member.id}
                      justifyContent="space-between"
                      alignItems="center"
                      padding="$sm"
                      borderRadius="$md"
                      borderWidth={1}
                      borderColor="$border"
                      backgroundColor="$background"
                    >
                      <YStack>
                        <Text color="$color">{member.user?.name || "Unknown user"}</Text>
                        <Text color="$textMuted" fontSize={12}>
                          {member.user?.email || member.userId}
                        </Text>
                      </YStack>
                      <Text color="$textMuted" fontSize={12}>
                        {member.role}
                      </Text>
                    </XStack>
                  ))
                ) : (
                  <Paragraph color="$textMuted">No members found.</Paragraph>
                )}

                <Text fontSize={16} fontWeight="600" color="$color" marginTop="$sm">
                  Pending invitations
                </Text>
                {membersLoading ? (
                  <Paragraph color="$textMuted">Loading invitations...</Paragraph>
                ) : membersData?.invitations?.length ? (
                  membersData.invitations.map((invite) => (
                    <XStack
                      key={invite.id}
                      justifyContent="space-between"
                      alignItems="center"
                      padding="$sm"
                      borderRadius="$md"
                      borderWidth={1}
                      borderColor="$border"
                      backgroundColor="$background"
                    >
                      <YStack>
                        <Text color="$color">{invite.email}</Text>
                        <Text color="$textMuted" fontSize={12}>
                          {invite.role} • invited {new Date(invite.createdAt).toLocaleDateString()}
                        </Text>
                      </YStack>
                    </XStack>
                  ))
                ) : (
                  <Paragraph color="$textMuted">No pending invites.</Paragraph>
                )}
              </YStack>
            </YStack>
          </XStack>
        )}
      </YStack>
    </YStack>
  );
}
