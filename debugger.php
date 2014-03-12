<?php
define("DEBUG", false);
define("DUMP_MODE", false);
/**
 * print friendly error report
 * @param unknown $msg
 */
function printe($msg) {
	printf("<h1>Debug Error:</h1><p>%s</p>", $msg);
	exit(1);
}
/**
 * print debug version info
 * @param string $remote_data_enabled
 * @param string $local_data_enabled
 */
function print_debug_info ($json) {
	echo "\n<!--NetdiskShell v1.0.1-->";
	echo "\n<!--template data start\n";
	var_dump($json);
	echo "template data end-->";
}
// =========================================================
if (DEBUG) {
	$argv = array("", "D:\\workshop\\2013", "\\templates\\");
}

if (!isset($argv) || count($argv) < 3) {
	printe("no debug code base found");
}

$code_base = $argv[1];
if (file_exists($code_base)) {
	/**
	 * $argv
	 * 0: current script
	 * 1: code base
	 * 2: template base
	 * 3: file location info
	 * 4: template data
	 */
	$code_tpl_base = $argv[2];
	$file_path = $code_base . $code_tpl_base . $argv[3];
	if (!file_exists($file_path)) {
		printe("page conf for $file_path is illegal");
	}
	require($code_base . '/' . 'LiteEngine.php');
	
	// resolve template location
	$lite = new TemplateEngine($code_base);
	$template = $code_tpl_base . $argv[3];
	$template = str_replace("\\", "/", $template);
	
	// attaching template data
	// in order to integrate debugging
	// implementation into this process
	// we keep mixing remote date and local 
	// data in mind at the very start
// 	$data = file_get_contents("./yun_home.json");
// 	$json = json_decode($data, true);
	$template_data = $argv[4];
	$json = json_decode($template_data, true);
	
	// finally rendering the template
	if (DUMP_MODE) {
		var_dump($template_data);
		exit(0);
	} else {
		$lite->render($template, $json);
		print_debug_info($json);
	}
} else {
	printe("no debug code base found: $code_base");
}