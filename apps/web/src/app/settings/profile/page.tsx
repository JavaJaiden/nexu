"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, H1, Input, Paragraph, Text, XStack, YStack } from "tamagui";
import { Camera, Mail } from "lucide-react";
import { readResponseError, readResponseJson } from "@/lib/http";

type ProfileUser = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
};

export default function SettingsProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/settings/profile", { cache: "no-store" });
        const data = await readResponseJson<{ user?: ProfileUser; error?: string }>(res);
        if (!res.ok) {
          throw new Error(readResponseError(res, data, "Failed to load profile."));
        }
        if (cancelled) return;
        const next = data?.user ?? null;
        setUser(next);
        setName(next?.name ?? "");
        setPhone(next?.phone ?? "");
        setAvatarUrl(next?.avatarUrl ?? "");
        setNewEmail(next?.email ?? "");
      } catch (error) {
        if (cancelled) return;
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "Failed to load profile.",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const initials = useMemo(() => {
    const source = name.trim() || user?.email || "U";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [name, user?.email]);

  const onAvatarSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setNotice({ kind: "error", text: "Please choose an image file for avatar." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      setNotice({ kind: "error", text: "Name is required." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
          avatarUrl: avatarUrl || undefined,
        }),
      });
      const data = await readResponseJson<{ user?: ProfileUser; error?: string }>(res);
      if (!res.ok) {
        throw new Error(readResponseError(res, data, "Failed to save profile."));
      }
      const nextUser = data?.user ?? null;
      setUser(nextUser);
      setName(nextUser?.name ?? name.trim());
      setPhone(nextUser?.phone ?? phone.trim());
      setAvatarUrl(nextUser?.avatarUrl ?? avatarUrl);
      setNotice({ kind: "success", text: "Profile updated." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to save profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  const changeEmail = async () => {
    if (!newEmail.trim() || !passwordConfirm) {
      setNotice({ kind: "error", text: "Provide new email and password confirmation." });
      return;
    }
    setEmailSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: passwordConfirm,
        }),
      });
      const data = await readResponseJson<{ user?: ProfileUser; error?: string }>(res);
      if (!res.ok) {
        throw new Error(readResponseError(res, data, "Failed to change email."));
      }
      if (data?.user) {
        setUser(data.user);
        setNewEmail(data.user.email);
      }
      setPasswordConfirm("");
      setShowEmailForm(false);
      setNotice({ kind: "success", text: "Email updated." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to change email.",
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const deleteProfile = async () => {
    if (deleteConfirmation !== "DELETE") {
      setNotice({ kind: "error", text: 'Type "DELETE" to confirm profile deletion.' });
      return;
    }
    setDeleting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmation: deleteConfirmation,
        }),
      });
      const data = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !data?.ok) {
        throw new Error(readResponseError(res, data, "Failed to delete profile."));
      }
      setNotice({ kind: "success", text: "Profile deleted. Redirecting..." });
      setTimeout(() => {
        router.push("/sign-in");
      }, 350);
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to delete profile.",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <YStack gap="$sm">
        <H1 fontSize={28}>Profile</H1>
        <Paragraph color="$textMuted">Loading profile...</Paragraph>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg">
      <YStack gap="$xs">
        <H1 fontSize={28} color="$color">
          Profile
        </H1>
        <Paragraph color="$textMuted">
          Update your account information. Changes are saved to your profile.
        </Paragraph>
      </YStack>

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

      <YStack
        gap="$md"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <XStack alignItems="center" gap="$md">
          <Avatar circular size="$6">
            {avatarUrl ? <Avatar.Image src={avatarUrl} /> : null}
            <Avatar.Fallback backgroundColor="$background">
              <Text fontSize={20} color="$color">
                {initials || "U"}
              </Text>
            </Avatar.Fallback>
          </Avatar>
          <YStack gap="$xs">
            <Text fontSize={14} color="$textMuted">
              Avatar
            </Text>
            <Button
              size="$3"
              backgroundColor="$background"
              borderWidth={1}
              borderColor="$border"
              color="$color"
              icon={<Camera size={14} />}
              onPress={() => fileInputRef.current?.click()}
            >
              Upload avatar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => onAvatarSelected(event.target.files)}
              style={{ display: "none" }}
            />
          </YStack>
        </XStack>

        <YStack gap="$xs">
          <Text fontSize={13} fontWeight="600" color="$color">
            Name
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            borderColor="$border"
            backgroundColor="$background"
            color="$color"
            placeholder="Your full name"
          />
        </YStack>

        <YStack gap="$xs">
          <Text fontSize={13} fontWeight="600" color="$color">
            Phone
          </Text>
          <Input
            value={phone}
            onChangeText={setPhone}
            borderColor="$border"
            backgroundColor="$background"
            color="$color"
            placeholder="(555) 555-5555"
          />
        </YStack>

        <Button
          alignSelf="flex-start"
          size="$3"
          backgroundColor="$color"
          color="$background"
          onPress={saveProfile}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save profile"}
        </Button>
      </YStack>

      <YStack
        gap="$md"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$backgroundSecondary"
      >
        <XStack alignItems="center" gap="$sm">
          <Mail size={16} color="currentColor" />
          <Text fontSize={16} fontWeight="600" color="$color">
            Email
          </Text>
        </XStack>
        <Text fontSize={14} color="$textMuted">
          Current email: {user?.email ?? "Unavailable"}
        </Text>

        {showEmailForm ? (
          <YStack gap="$sm">
            <Input
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="New email address"
              borderColor="$border"
              backgroundColor="$background"
              color="$color"
              autoCapitalize="none"
            />
            <Input
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholder="Confirm with current password"
              secureTextEntry
              borderColor="$border"
              backgroundColor="$background"
              color="$color"
            />
            <XStack gap="$sm">
              <Button
                size="$3"
                backgroundColor="$color"
                color="$background"
                onPress={changeEmail}
                disabled={emailSaving}
              >
                {emailSaving ? "Updating..." : "Update email"}
              </Button>
              <Button
                size="$3"
                backgroundColor="$background"
                borderWidth={1}
                borderColor="$border"
                color="$color"
                onPress={() => {
                  setShowEmailForm(false);
                  setPasswordConfirm("");
                }}
              >
                Cancel
              </Button>
            </XStack>
          </YStack>
        ) : (
          <Button
            alignSelf="flex-start"
            size="$3"
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$border"
            color="$color"
            onPress={() => setShowEmailForm(true)}
          >
            Change email
          </Button>
        )}
      </YStack>

      <YStack
        gap="$md"
        padding="$lg"
        borderRadius="$lg"
        borderWidth={1}
        borderColor="$error"
        backgroundColor="rgba(239,68,68,0.08)"
      >
        <Text fontSize={16} fontWeight="600" color="$error">
          Danger zone
        </Text>
        <Paragraph color="$textMuted">
          Deleting your profile permanently removes your account data from this app.
        </Paragraph>
        <YStack gap="$xs">
          <Text fontSize={13} color="$textMuted">
            Type <Text color="$color">DELETE</Text> to confirm
          </Text>
          <Input
            value={deleteConfirmation}
            onChangeText={setDeleteConfirmation}
            placeholder="DELETE"
            borderColor="$border"
            backgroundColor="$background"
            color="$color"
            autoCapitalize="characters"
          />
        </YStack>
        <Button
          alignSelf="flex-start"
          size="$3"
          backgroundColor="$error"
          color="$background"
          onPress={deleteProfile}
          disabled={deleting || deleteConfirmation !== "DELETE"}
        >
          {deleting ? "Deleting profile..." : "Delete profile"}
        </Button>
      </YStack>
    </YStack>
  );
}
