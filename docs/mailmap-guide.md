# Git Mailmap Guide

## What is a Mailmap?

A `.mailmap` file is Git's standard solution for consolidating multiple email addresses and names into a single canonical identity. This is useful when:

- A developer uses different email addresses (work email, personal email, etc.)
- A developer's name changes (marriage, preferred name, etc.)
- You want consistent attribution across your git history

## How to Use

### 1. Create a `.mailmap` file

Create a `.mailmap` file in your repository root:

```bash
touch .mailmap
```

### 2. Add Mappings

The format is:

```
Canonical Name <canonical@email.com> Commit Name <commit@email.com>
```

**Example:**

```
# Consolidate multiple emails for the same person
Adrian <ahalaburda@xseed.com.uy> Adrian <adh761@gmail.com>

# Fix a typo in commit history
John Doe <john@company.com> Jon Doe <john@company.com>

# Update name after marriage
Jane Smith <jane@company.com> Jane Doe <jane@company.com>
```

### 3. How Xseed Metrics Uses Mailmap

Xseed Dev Metrics automatically respects your `.mailmap` file. All git commands now use the `--use-mailmap` flag, which means:

- **Author statistics** will be consolidated under the canonical identity
- **Commit counts** will be unified across all mapped identities
- **Line counts** will be aggregated correctly
- **File statistics** will show the canonical author

### 4. Testing Your Mailmap

You can test your mailmap configuration using standard Git commands:

```bash
# See all unique authors (respecting mailmap)
git log --use-mailmap --format='%aN <%aE>' | sort -u

# See commit counts by author (respecting mailmap)
git shortlog -sne --use-mailmap

# Compare without mailmap
git shortlog -sne --no-mailmap
```

### 5. Example Scenario

**Problem:** You have commits from two emails:
- `john@gmail.com` (personal)
- `john@company.com` (work)

**Solution:** Add this to `.mailmap`:

```
John Doe <john@company.com> John Doe <john@gmail.com>
```

Now all metrics will show under `John Doe <john@company.com>`.

## Best Practices

1. **Commit the `.mailmap` file** - Add it to your repository so everyone uses the same mappings
2. **Use the canonical email** - Choose one email as the "official" identity
3. **Document changes** - Add comments in `.mailmap` explaining why mappings exist
4. **Team collaboration** - Make sure your team knows about the mailmap file

## Advanced Usage

### Map Name Changes

```
Jane Smith <jane@company.com> Jane Doe <jane@company.com>
```

### Map Multiple Identities

```
# Consolidate multiple work emails
John Doe <john@company.com> John Doe <john@oldcompany.com>
John Doe <john@company.com> John Doe <jdoe@company.com>
```

### Just Fix Email (Keep Original Name)

```
<correct@email.com> <wrong@email.com>
```

## Learn More

- [Official Git Mailmap Documentation](https://git-scm.com/docs/gitmailmap)
- [Git SCM Book - Mailmap](https://git-scm.com/docs/git-shortlog#_mapping_authors)

## Troubleshooting

**Q: My metrics still show duplicates**

A: Make sure you:
1. Created the `.mailmap` file in the repository root
2. Used the correct format (check for typos)
3. Rebuilt the project with `npm run build`
4. The email addresses match exactly what's in `git log`

**Q: How do I find all emails for an author?**

```bash
git log --format='%aN <%aE>' | grep "Adrian" | sort -u
```

**Q: Can I use mailmap for other people's commits?**

Yes! The `.mailmap` file can map any identity, not just yours.
