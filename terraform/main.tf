variable app_id {}
variable sub_key {}
variable microsoft_app_id {}
variable microsoft_app_password {}

data "template_file" "secrets" {
  template = "${file("localConfig.tpl")}"
  vars {
    app_id = "${var.app_id}"
    sub_key = "${var.sub_key}"
    microsoft_app_id = "${var.microsoft_app_id}"
    microsoft_app_password = "${var.microsoft_app_password}"
  }
}

resource "aws_security_group" "climate-bot" {
  name = "climate-bot"
}

data "aws_ami" "debian" {
  filter {
    name = "virtualization-type",
    values = ["hvm"]
  }
  filter {
    name = "name",
    values = ["debian-jessie-*"]
  }
  owners = ["379101102735"]
  most_recent = true
}

resource "aws_security_group_rule" "outbound" {
  type        = "egress"
  from_port   = 0
  to_port     = 0
  protocol    = "-1"
  cidr_blocks = ["0.0.0.0/0"]

  security_group_id = "${aws_security_group.climate-bot.id}"
}


resource "aws_security_group_rule" "http_incoming" {
  type        = "ingress"
  from_port   = 80
  to_port     = 80
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]

  security_group_id = "${aws_security_group.climate-bot.id}"
}

resource "aws_security_group_rule" "https_incoming" {
  type        = "ingress"
  from_port   = 443
  to_port     = 443
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]

  security_group_id = "${aws_security_group.climate-bot.id}"
}

resource "aws_route53_record" "bot" {
  zone_id = "Z3USS9SVLB2LY1"
  name = "${var.dns}."
  type = "A"
  ttl = "60"
  records = ["${aws_instance.climate-bot.public_ip}"]
}

resource "aws_instance" "climate-bot" {
  ami           = "${data.aws_ami.debian.id}"
  instance_type = "m3.large"
  key_name      = "gateway"
  security_groups = ["default", "${aws_security_group.climate-bot.name}"]
  iam_instance_profile = "${var.iam_profile}"
  
  user_data = "${file("./files/bootstrap.sh")}"
  
  root_block_device {
    volume_size = 30
  }

  tags {
    Name        = "climate-bot"
  }

  connection {
    type = "ssh"
    user = "admin"
    private_key = "${file("~/.ssh/gateway/id_rsa")}"
    bastion_host = "gateway.informaticslab.co.uk"
    bastion_user = "ec2-user"
    bastion_private_key = "${file("~/.ssh/id_rsa")}"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo mkdir /opt/climate-bot",
      "sudo chown admin /opt/climate-bot",
    ]
  }

  provisioner "file" {
    source = "../"
    destination = "/opt/climate-bot"
  }

  provisioner "file" {
    content = "${data.template_file.secrets.rendered}"
    destination = "/opt/climate-bot/bot_api/localConfig.json"
  }

  provisioner "remote-exec" {
    inline = [
      "chmod 600 /opt/climate-bot/bot_api/localConfig.json",
      "while [ ! -f /usr/local/bin/docker-compose ]; do sleep 20; done",
      "echo BOT_API_DNS=${var.dns} > /opt/climate-bot/.env",
      "cd /opt/climate-bot",
      "sudo /usr/bin/docker network create nginx-proxy",
      "sudo /usr/local/bin/docker-compose up -d"
    ]
  }
}
