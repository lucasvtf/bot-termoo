const ids = (process.env.ADMIN_USER_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const isAdmin = (userId) => ids.includes(String(userId));

export async function requireAdmin(interaction) {
  if (isAdmin(interaction.user.id)) return true;
  await interaction.reply({ content: 'Esse comando é só pra admin.', ephemeral: true });
  return false;
}
