from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Search Engine</title>
</head>
<body style="margin: 0; font-family: Arial, sans-serif; background-color: #f8f9fa; position: relative; height: 100vh;">

    <!-- Top Navigation -->
    <div id="top-navigation" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 50px; display: flex; justify-content: flex-end; align-items: center; background-color: #fff; font-size: 14px; font-family: Arial, sans-serif; color: #000;">
    
   <a href="#" 
      style="margin: 0 15px; text-decoration: none; color: #000; background-color: #fff; font-size: 14px; font-family: Arial, sans-serif; position: absolute; top: 10px; left: 10px; width: 50px; height: 20px;">Mail</a>
   
   <a href="#" 
      style="margin: 0 15px; text-decoration: none; color: #000; background-color: #fff; font-size: 14px; font-family: Arial, sans-serif; position: absolute; top: 10px; left: 70px; width: 60px; height: 20px;">Images</a>
   
   <a href="#" 
      style="margin: 0 15px; text-decoration: none; color: #000; background-color: #fff; font-size: 14px; font-family: Arial, sans-serif; position: absolute; top: 10px; left: 140px; width: 70px; height: 20px;">Settings</a>
   
   <a href="#" 
      style="margin: 0 15px; text-decoration: none; color: #000; background-color: #fff; font-size: 14px; font-family: Arial, sans-serif; position: absolute; top: 10px; left: 210px; width: 70px; height: 20px;">Log out</a>
</div>

    <!-- Logo -->
    <div id="logo-container" style="position: absolute; top: 150px; left: calc(50% - 50px); width: 100px; height: 100px; background-color: transparent;">
        <img src="/Users/monalikapadmareddy/Library/CloudStorage/OneDrive-StonyBrookUniversity/PhD-Research/Web Automation/Segmentation/code/sample-logo.jpg" alt="Sample Logo" style="width: 100%; height: 100%;">
    </div>

    <!-- Search Bar -->
    <div id="search-container" style="position: absolute; top: 270px; left: calc(50% - 25%); width: 50%; display: flex; flex-direction: column; align-items: center; background-color: transparent;">
        <input id="search-bar" type="text" placeholder="Search the web or type a URL" 
               style="width: 100%; height: 40px; padding: 10px; font-size: 16px; font-family: Arial, sans-serif; color: #000; background-color: #fff; border: 1px solid #d9d9d9; border-radius: 24px; outline: none; margin-bottom: 10px;">
        <button id="search-button" style="width: 150px; height: 40px; font-size: 14px; font-family: Arial, sans-serif; color: #fff; background-color: #4285f4; border: none; border-radius: 4px; cursor: pointer;">Search</button>
    </div>

    <!-- Footer -->
    <footer id="footer" style="position: absolute; bottom: 0; left: 0; width: 100%; height: 50px; background-color: #f2f2f2; text-align: center; line-height: 50px; font-size: 14px; font-family: Arial, sans-serif; color: #000;">
    <a id="footer-privacy" href="#" 
   style="position: absolute; left: 10px; bottom: 10px; margin-right: 15px; background-color: transparent; text-decoration: none; color: #000;">
   Privacy
</a>

<a id="footer-terms" href="#" 
   style="position: absolute; left: 70px; bottom: 10px; margin-right: 15px; background-color: transparent; text-decoration: none; color: #000;">
   Terms
</a>

<a id="footer-settings" href="#" 
   style="position: absolute; left: 130px; bottom: 10px; background-color: transparent; text-decoration: none; color: #000;">
   Settings
</a>

    </footer>
</body>
</html>
"""

def is_visible(element):
    return element.is_displayed() and element.size["width"] > 0 and element.size["height"] > 0

def get_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")  # Run in headless mode for testing
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    return driver

# Main Execution
driver = get_driver()
try:
    driver.get("data:text/html;charset=utf-8," + html_content)
    body = driver.find_element(By.TAG_NAME, "body")
    body_content = body.get_attribute("innerHTML")
    print("Body Content (Static HTML):")
    print(body_content)

    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.XPATH, "//*")))

    RELEVANT_TAGS = ["div", "a", "button", "img", "input", "footer"]
    elements = []
    for tag in RELEVANT_TAGS:
        elements.extend(driver.find_elements(By.TAG_NAME, tag))

    data = []
    for elem in elements:
        if is_visible(elem):
            try:
                data.append({
                    "Tag Name": elem.tag_name,
                    "ID": elem.get_attribute("id"),
                    "Class": elem.get_attribute("class"),
                    "Text": elem.text.strip(),
                    "x": elem.location["x"],
                    "y": elem.location["y"],
                    "Width": elem.size["width"],
                    "Height": elem.size["height"],
                    "Background Color": elem.value_of_css_property("background-color"),
                    "Font Size": elem.value_of_css_property("font-size"),
                    "Font Color": elem.value_of_css_property("color"),
                })
            except Exception as e:
                print(f"Error processing element: {e}")

    df = pd.DataFrame(data)
    print(df)  # Display the extracted data
finally:
    driver.quit()
