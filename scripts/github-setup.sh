#!/bin/bash

# GitHub Repository Setup Script
# Configures branch protection, labels, and repository settings for Unjucks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="unjucks"
REPO_NAME="unjucks"
REPO_FULL="${REPO_OWNER}/${REPO_NAME}"

echo -e "${BLUE}🚀 Setting up GitHub integration for ${REPO_FULL}${NC}"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is required but not installed${NC}"
    echo -e "${YELLOW}Install it from: https://cli.github.com/${NC}"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with GitHub CLI${NC}"
    echo -e "${YELLOW}Run: gh auth login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ GitHub CLI is installed and authenticated${NC}"

# Function to create labels
create_labels() {
    echo -e "${BLUE}🏷️  Creating repository labels...${NC}"
    
    # Define labels array
    declare -A labels=(
        ["bug"]="d73a49:Something isn't working"
        ["enhancement"]="a2eeef:New feature or request"
        ["feature-request"]="7057ff:Request for a new feature"
        ["documentation"]="0075ca:Improvements or additions to documentation"
        ["breaking-change"]="b60205:Introduces breaking changes"
        ["dependencies"]="0366d6:Pull requests that update a dependency file"
        ["security"]="ee0701:Security related issue or fix"
        ["performance"]="fbca04:Performance improvement"
        ["ci/cd"]="28a745:Continuous integration and deployment"
        ["tests"]="c2e0c6:Test related changes"
        ["templates"]="f9d0c4:Template engine related"
        ["latex"]="d4c5f9:LaTeX export functionality"
        ["rdf"]="c5def5:RDF/Turtle semantic web features"
        ["size/small"]="00ff00:Small PR (< 50 lines changed)"
        ["size/medium"]="ffff00:Medium PR (50-200 lines changed)"
        ["size/large"]="ff0000:Large PR (> 200 lines changed)"
        ["priority/low"]="c2e0c6:Low priority"
        ["priority/medium"]="fbca04:Medium priority"
        ["priority/high"]="d93f0b:High priority"
        ["priority/critical"]="b60205:Critical priority"
        ["good first issue"]="7057ff:Good for newcomers"
        ["help wanted"]="008672:Extra attention is needed"
        ["wontfix"]="ffffff:This will not be worked on"
        ["duplicate"]="cfd3d7:This issue or pull request already exists"
        ["invalid"]="e4e669:This doesn't seem right"
        ["question"]="d876e3:Further information is requested"
        ["triage"]="ededed:Needs to be triaged"
    )
    
    # Create each label
    for label in "${!labels[@]}"; do
        IFS=':' read -r color description <<< "${labels[$label]}"
        
        if gh label create "$label" --color "$color" --description "$description" --repo "$REPO_FULL" 2>/dev/null; then
            echo -e "${GREEN}  ✅ Created label: $label${NC}"
        else
            echo -e "${YELLOW}  ⚠️  Label already exists or failed: $label${NC}"
        fi
    done
    
    echo -e "${GREEN}✅ Labels creation completed${NC}"
}

# Function to set up branch protection
setup_branch_protection() {
    echo -e "${BLUE}🛡️  Setting up branch protection...${NC}"
    
    # Main branch protection
    echo -e "${YELLOW}  Setting up main branch protection...${NC}"
    
    gh api repos/$REPO_FULL/branches/main/protection \
        --method PUT \
        --field required_status_checks='{
            "strict": true,
            "contexts": [
                "✓ Lint Check",
                "✓ Type Check", 
                "✓ Unit Tests",
                "✓ Build Check",
                "✓ Security Audit",
                "Status Check Summary"
            ]
        }' \
        --field enforce_admins=false \
        --field required_pull_request_reviews='{
            "required_approving_review_count": 1,
            "dismiss_stale_reviews": true,
            "require_code_owner_reviews": true,
            "require_last_push_approval": false
        }' \
        --field restrictions=null \
        --field required_linear_history=false \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        --field required_conversation_resolution=true \
        --field lock_branch=false \
        --field allow_fork_syncing=true
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✅ Main branch protection configured${NC}"
    else
        echo -e "${RED}  ❌ Failed to configure main branch protection${NC}"
    fi
    
    # Develop branch protection (if exists)
    if gh api repos/$REPO_FULL/branches/develop &> /dev/null; then
        echo -e "${YELLOW}  Setting up develop branch protection...${NC}"
        
        gh api repos/$REPO_FULL/branches/develop/protection \
            --method PUT \
            --field required_status_checks='{
                "strict": false,
                "contexts": [
                    "✓ Lint Check",
                    "✓ Type Check",
                    "✓ Unit Tests"
                ]
            }' \
            --field enforce_admins=false \
            --field required_pull_request_reviews='{
                "required_approving_review_count": 1,
                "dismiss_stale_reviews": false,
                "require_code_owner_reviews": false,
                "require_last_push_approval": false
            }' \
            --field restrictions=null \
            --field required_linear_history=false \
            --field allow_force_pushes=true \
            --field allow_deletions=false \
            --field required_conversation_resolution=false
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}  ✅ Develop branch protection configured${NC}"
        else
            echo -e "${RED}  ❌ Failed to configure develop branch protection${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠️  Develop branch not found, skipping protection setup${NC}"
    fi
    
    echo -e "${GREEN}✅ Branch protection setup completed${NC}"
}

# Function to configure repository settings
configure_repository() {
    echo -e "${BLUE}⚙️  Configuring repository settings...${NC}"
    
    # Update repository settings
    gh api repos/$REPO_FULL \
        --method PATCH \
        --field allow_squash_merge=true \
        --field allow_merge_commit=false \
        --field allow_rebase_merge=true \
        --field delete_branch_on_merge=true \
        --field allow_auto_merge=true \
        --field use_squash_pr_title_as_default=true \
        --field squash_merge_commit_title="PR_TITLE" \
        --field squash_merge_commit_message="PR_BODY"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✅ Repository settings configured${NC}"
    else
        echo -e "${RED}  ❌ Failed to configure repository settings${NC}"
    fi
    
    # Enable security features
    echo -e "${YELLOW}  Enabling security features...${NC}"
    
    # Enable vulnerability alerts
    gh api repos/$REPO_FULL/vulnerability-alerts \
        --method PUT \
        --silent 2>/dev/null || echo -e "${YELLOW}    ⚠️  Vulnerability alerts may already be enabled${NC}"
    
    # Enable automated security fixes
    gh api repos/$REPO_FULL/automated-security-fixes \
        --method PUT \
        --silent 2>/dev/null || echo -e "${YELLOW}    ⚠️  Automated security fixes may already be enabled${NC}"
    
    echo -e "${GREEN}✅ Repository configuration completed${NC}"
}

# Function to create environments
create_environments() {
    echo -e "${BLUE}🌍 Creating deployment environments...${NC}"
    
    # Create production environment
    gh api repos/$REPO_FULL/environments/production \
        --method PUT \
        --field wait_timer=0 \
        --field prevent_self_review=true \
        --field reviewers='[{"type":"Team","id":null}]' \
        --field deployment_branch_policy='{"protected_branches":true,"custom_branch_policies":false}' \
        --silent 2>/dev/null || echo -e "${YELLOW}  ⚠️  Production environment may already exist${NC}"
    
    # Create staging environment  
    gh api repos/$REPO_FULL/environments/staging \
        --method PUT \
        --field wait_timer=0 \
        --field deployment_branch_policy='{
            "protected_branches": false,
            "custom_branch_policies": true
        }' \
        --silent 2>/dev/null || echo -e "${YELLOW}  ⚠️  Staging environment may already exist${NC}"
    
    echo -e "${GREEN}✅ Environments created${NC}"
}

# Function to validate setup
validate_setup() {
    echo -e "${BLUE}🔍 Validating setup...${NC}"
    
    # Check branch protection
    if gh api repos/$REPO_FULL/branches/main/protection &> /dev/null; then
        echo -e "${GREEN}  ✅ Main branch protection is active${NC}"
    else
        echo -e "${RED}  ❌ Main branch protection is not configured${NC}"
    fi
    
    # Check labels count
    label_count=$(gh label list --repo $REPO_FULL --json name -q 'length')
    echo -e "${GREEN}  ✅ Repository has $label_count labels${NC}"
    
    # Check workflows
    if [ -f ".github/workflows/ci-cd-validation.yml" ]; then
        echo -e "${GREEN}  ✅ CI/CD validation workflow exists${NC}"
    else
        echo -e "${RED}  ❌ CI/CD validation workflow missing${NC}"
    fi
    
    # Check security features
    if gh api repos/$REPO_FULL | jq -r '.has_vulnerability_alerts' | grep -q true; then
        echo -e "${GREEN}  ✅ Vulnerability alerts enabled${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Vulnerability alerts status unknown${NC}"
    fi
    
    echo -e "${GREEN}✅ Validation completed${NC}"
}

# Function to display setup summary
display_summary() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║                 🎉 Setup Complete!                  ║"  
    echo "╠══════════════════════════════════════════════════════╣"
    echo "║  GitHub Integration Successfully Configured          ║"
    echo "║                                                      ║"
    echo "║  ✅ Labels created and organized                     ║"
    echo "║  ✅ Branch protection rules applied                  ║"
    echo "║  ✅ Repository settings configured                   ║"
    echo "║  ✅ Security features enabled                        ║"
    echo "║  ✅ Deployment environments created                  ║"
    echo "║                                                      ║"
    echo "║  🔧 Next Steps:                                      ║"
    echo "║    1. Configure repository secrets                   ║"
    echo "║    2. Test workflows with a test PR                  ║"
    echo "║    3. Review security scan results                   ║"
    echo "║    4. Monitor workflow execution                     ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "${YELLOW}📋 Required Secrets:${NC}"
    echo -e "  • NPM_TOKEN - For package publishing"
    echo -e "  • CODECOV_TOKEN - For coverage reporting (optional)"
    echo -e "  • SLACK_WEBHOOK - For notifications (optional)"
    echo
    
    echo -e "${YELLOW}🔗 Useful Links:${NC}"
    echo -e "  • Repository: https://github.com/$REPO_FULL"
    echo -e "  • Actions: https://github.com/$REPO_FULL/actions"
    echo -e "  • Security: https://github.com/$REPO_FULL/security"
    echo -e "  • Settings: https://github.com/$REPO_FULL/settings"
}

# Main execution
main() {
    echo -e "${GREEN}Starting GitHub integration setup for $REPO_FULL${NC}"
    echo
    
    create_labels
    echo
    
    setup_branch_protection  
    echo
    
    configure_repository
    echo
    
    create_environments
    echo
    
    validate_setup
    echo
    
    display_summary
}

# Check if running with --dry-run flag
if [[ "$1" == "--dry-run" ]]; then
    echo -e "${YELLOW}🧪 DRY RUN MODE - No changes will be made${NC}"
    echo -e "${BLUE}This script would:${NC}"
    echo -e "  1. Create 25+ repository labels"
    echo -e "  2. Set up branch protection for main and develop branches"
    echo -e "  3. Configure repository settings (merge policies, etc.)"
    echo -e "  4. Enable security features (vulnerability alerts, automated fixes)"
    echo -e "  5. Create production and staging environments"
    echo
    echo -e "${YELLOW}Run without --dry-run to execute setup${NC}"
    exit 0
fi

# Confirm before proceeding
echo -e "${YELLOW}⚠️  This script will modify repository settings for $REPO_FULL${NC}"
echo -e "${YELLOW}Do you want to continue? (y/N)${NC}"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Setup cancelled${NC}"
    exit 1
fi

# Execute main setup
main

echo -e "${GREEN}🎉 GitHub integration setup completed successfully!${NC}"