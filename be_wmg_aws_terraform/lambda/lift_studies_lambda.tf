# resource "null_resource" "lift_studies_lambda_dependencies" {
#   provisioner "local-exec" {
#     command = "cd ${path.module}/lift_studies/src && pip3 install -r requirements.txt -t ./lib"
#   }

#   triggers = {
#     lift_studies = sha256(file("${path.module}/lift_studies/src/lift_studies.py"))
#     # package = sha256(file("${path.module}/lift_studies/src/package.json"))
#   }
# }


# data "null_data_source" "lift_studies_wait_for_lambda_exporter" {
#   inputs = {
#     lambda_dependency_id = "${null_resource.lift_studies_lambda_dependencies.id}"
#     source_dir           = "${path.module}/lift_studies/src/"
#   }
# }

# data "archive_file" "lift_studies_lambda" {
#   output_path = "${path.module}/lift_studies/lambda-bundle.zip"
#   source_dir  = "${data.null_data_source.lift_studies_wait_for_lambda_exporter.outputs["source_dir"]}"
#   type        = "zip"
# }

# resource "aws_lambda_function" "lift_studies" {
#   filename         = data.archive_file.lift_studies_lambda.output_path
#   function_name    = "lift_studies"
#   handler          = "lift_studies.lambda_handler"
#   runtime          = "python3.11"
#   role             = aws_iam_role.lambda_role.arn
#   source_code_hash = data.archive_file.lift_studies_lambda.output_base64sha256
# }
