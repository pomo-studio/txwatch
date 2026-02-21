provider "aws" {
  alias  = "primary"
  region = var.primary_region

  default_tags {
    tags = {
      Project    = "txwatch"
      ManagedBy  = "terraform"
      Repository = "pomo-studio/txwatch"
    }
  }
}

provider "aws" {
  alias  = "dr"
  region = var.dr_region

  default_tags {
    tags = {
      Project    = "txwatch"
      ManagedBy  = "terraform"
      Repository = "pomo-studio/txwatch"
      Region     = "dr"
    }
  }
}
