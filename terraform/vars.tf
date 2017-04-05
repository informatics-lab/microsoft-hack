provider "aws" {
  region = "eu-west-1"
}

variable "iam_profile" {
  default = "climate-bot"
}

variable "dns" {
  default = "bot2.informaticslab.co.uk"
}
